"""Compile and sample production GLSL in Mesa/EGL, without loading a browser page."""
import ctypes as C
import ctypes.util
import json, math, subprocess
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
source="import fs from 'node:fs';import vm from 'node:vm';const context={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),context);console.log(JSON.stringify(context.window.MikuEarthRenderer.shaders));"
shaders=json.loads(subprocess.check_output(['node','--input-type=module','-e',source,str(ROOT/'dist/earth-renderer.js')]))
egl=C.CDLL(ctypes.util.find_library('EGL'))
egl.eglGetProcAddress.argtypes=[C.c_char_p];egl.eglGetProcAddress.restype=C.c_void_p
def bind(name,restype,args):
    address=egl.eglGetProcAddress(name.encode())
    if not address:raise RuntimeError('Unavailable '+name)
    return C.CFUNCTYPE(restype,*args)(address)
pointer=C.c_void_p;integer=C.c_int;uint=C.c_uint;float_=C.c_float
display=bind('eglGetPlatformDisplayEXT',pointer,[uint,pointer,C.POINTER(integer)])(0x31DD,None,None)
initialize=bind('eglInitialize',uint,[pointer,C.POINTER(integer),C.POINTER(integer)])
major,minor=integer(),integer()
assert initialize(display,C.byref(major),C.byref(minor)),'EGL initialization failed'
assert bind('eglBindAPI',uint,[uint])(0x30A0),'ES API unavailable'
attributes=(integer*15)(0x3033,0x0001,0x3040,0x0004,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,0,0x3038)
config=pointer();count=integer()
assert bind('eglChooseConfig',uint,[pointer,C.POINTER(integer),C.POINTER(pointer),integer,C.POINTER(integer)])(display,attributes,C.byref(config),1,C.byref(count)) and count.value
surface=bind('eglCreatePbufferSurface',pointer,[pointer,pointer,C.POINTER(integer)])(display,config,(integer*5)(0x3057,512,0x3056,512,0x3038))
context=bind('eglCreateContext',pointer,[pointer,pointer,pointer,C.POINTER(integer)])(display,config,None,(integer*3)(0x3098,2,0x3038))
assert surface and context,'EGL context creation failed'
assert bind('eglMakeCurrent',uint,[pointer,pointer,pointer,pointer])(display,surface,surface,context)

create_shader=bind('glCreateShader',uint,[uint]);shader_source=bind('glShaderSource',None,[uint,integer,C.POINTER(C.c_char_p),C.POINTER(integer)])
compile_shader=bind('glCompileShader',None,[uint]);get_shader=bind('glGetShaderiv',None,[uint,uint,C.POINTER(integer)])
shader_log=bind('glGetShaderInfoLog',None,[uint,integer,C.POINTER(integer),C.c_char_p])
def compile(type_,text):
    shader=create_shader(type_);encoded=text.encode();string=C.c_char_p(encoded);length=integer(len(encoded));shader_source(shader,1,C.byref(string),C.byref(length));compile_shader(shader);status=integer();get_shader(shader,0x8B81,C.byref(status))
    if not status.value:
        log=C.create_string_buffer(8192);shader_log(shader,len(log),None,log);raise AssertionError(log.value.decode())
    return shader
vertex=compile(0x8B31,shaders['vertex']);fragment=compile(0x8B30,shaders['fragment'])
compile(0x8B30,shaders['fragment'].replace('precision highp float;','precision mediump float;'))
program=bind('glCreateProgram',uint,[])()
attach=bind('glAttachShader',None,[uint,uint]);attach(program,vertex);attach(program,fragment)
bind('glLinkProgram',None,[uint])(program);linked=integer();bind('glGetProgramiv',None,[uint,uint,C.POINTER(integer)])(program,0x8B82,C.byref(linked));assert linked.value,'Shader link failed'
bind('glUseProgram',None,[uint])(program)
buffer=uint();bind('glGenBuffers',None,[integer,C.POINTER(uint)])(1,C.byref(buffer));bind('glBindBuffer',None,[uint,uint])(0x8892,buffer.value)
points=(float_*12)(-1,-1,1,-1,-1,1,-1,1,1,-1,1,1)
bind('glBufferData',None,[uint,C.c_ssize_t,pointer,uint])(0x8892,C.sizeof(points),points,0x88E4)
position=bind('glGetAttribLocation',integer,[uint,C.c_char_p])(program,b'aPosition');bind('glEnableVertexAttribArray',None,[uint])(position);bind('glVertexAttribPointer',None,[uint,integer,uint,uint,integer,pointer])(position,2,0x1406,0,0,None)
texture=uint();bind('glGenTextures',None,[integer,C.POINTER(uint)])(1,C.byref(texture));bind('glBindTexture',None,[uint,uint])(0x0DE1,texture.value)
atlas=Image.open(ROOT/'dist/assets/earth-atlas.webp').convert('RGB');image=C.create_string_buffer(atlas.tobytes())
bind('glPixelStorei',None,[uint,integer])(0x0CF5,1)
bind('glTexImage2D',None,[uint,integer,integer,integer,integer,integer,uint,uint,pointer])(0x0DE1,0,0x1907,atlas.width,atlas.height,0,0x1907,0x1401,image)
param=bind('glTexParameteri',None,[uint,uint,integer]);param(0x0DE1,0x2801,0x2601);param(0x0DE1,0x2800,0x2601);param(0x0DE1,0x2802,0x2901);param(0x0DE1,0x2803,0x812F)
uniform_location=bind('glGetUniformLocation',integer,[uint,C.c_char_p]);one=bind('glUniform1f',None,[integer,float_]);two=bind('glUniform2f',None,[integer,float_,float_])
locations={name:uniform_location(program,name.encode()) for name in ['uSize','uCenter','uRadius','uDpr','uAngles','uLight','uGlow','uAtlas']}
bind('glUniform1i',None,[integer,integer])(locations['uAtlas'],0)
two(locations['uSize'],512,512);two(locations['uCenter'],256,256);one(locations['uRadius'],192);one(locations['uDpr'],1);one(locations['uLight'],0);one(locations['uGlow'],1)
bind('glViewport',None,[integer,integer,integer,integer])(0,0,512,512)
clear_color=bind('glClearColor',None,[float_,float_,float_,float_]);clear=bind('glClear',None,[uint]);draw=bind('glDrawArrays',None,[uint,integer,integer]);read=bind('glReadPixels',None,[integer,integer,integer,integer,uint,uint,pointer]);get_error=bind('glGetError',uint,[])
def sample(lng,lat,light=0):
    two(locations['uAngles'],math.radians(lng),math.radians(lat));one(locations['uLight'],light);clear_color(0,0,0,0);clear(0x4000);draw(0x0004,0,6)
    center=(C.c_ubyte*4)();outside=(C.c_ubyte*4)();read(256,256,1,1,0x1908,0x1401,center);read(0,0,1,1,0x1908,0x1401,outside)
    assert get_error()==0,'GL draw error';assert center[3]==255 and outside[3]==0,'Sphere alpha incorrect';return list(center)
land=sample(104.1954,35.8617);ocean=sample(180,0);light=sample(104.1954,35.8617,1)
assert land[1]>ocean[1]+35,(land,ocean)
assert light[1]>land[1],(light,land)
sample(0,90);sample(-180,-90)
print(json.dumps({'status':'passed','shaders':['vertex','highp fragment','mediump fragment'],'draws':5,'land_center':land,'ocean_center':ocean,'light_center':light}))
bind('eglMakeCurrent',uint,[pointer,pointer,pointer,pointer])(display,None,None,None)
bind('eglDestroyContext',uint,[pointer,pointer])(display,context);bind('eglDestroySurface',uint,[pointer,pointer])(display,surface);bind('eglTerminate',uint,[pointer])(display)
