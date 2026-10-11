/* Local GPU sphere shading and a texture-based Canvas fallback. No CDN. */
(()=>{
'use strict';
const VERTEX=`attribute vec2 aPosition;
void main(){gl_Position=vec4(aPosition,0.0,1.0);}`;
const FRAGMENT=`precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uDpr;
uniform vec2 uAngles;
uniform float uLight;
uniform float uGlow;
const float PI=3.141592653589793;
void main(){
 vec2 p=(gl_FragCoord.xy/uDpr-vec2(uCenter.x,uSize.y-uCenter.y))/uRadius;
 float r=length(p);
 vec3 mint=mix(vec3(0.24,0.90,0.83),vec3(0.06,0.51,0.56),uLight);
 if(r>1.16)discard;
 if(r>1.0){
  float atmosphere=exp(-(r-1.0)*48.0)*0.26;
  float alpha=atmosphere*(1.0-smoothstep(1.05,1.16,r))*uGlow;
  gl_FragColor=vec4(mint,alpha);return;
 }
 vec3 normal=vec3(p,sqrt(max(0.0,1.0-dot(p,p))));
 float cy=cos(uAngles.x),sy=sin(uAngles.x),cp=cos(uAngles.y),sp=sin(uAngles.y);
 float y=normal.y*cp+normal.z*sp;
 float zz=-normal.y*sp+normal.z*cp;
 vec3 model=vec3(normal.x*cy+zz*sy,y,-normal.x*sy+zz*cy);
 float lon=atan(model.x,model.z),lat=asin(clamp(model.y,-1.0,1.0));
 vec2 uv=vec2(lon/(2.0*PI)+0.5,0.5-lat/PI);
 vec3 atlas=texture2D(uAtlas,uv).rgb;
 vec3 sun=normalize(vec3(-0.48,0.62,0.72));
 float diffuse=max(0.0,dot(normal,sun));
 float soft=0.20+0.80*smoothstep(-0.16,0.80,dot(normal,sun));
 vec3 ocean=mix(vec3(0.014,0.055,0.105),vec3(0.36,0.66,0.74),uLight);
 vec3 land=mix(vec3(0.05,0.32,0.32),vec3(0.20,0.63,0.56),uLight);
 vec3 color=mix(ocean,land,atlas.r)*(0.45+soft*0.80);
 float specular=pow(max(0.0,dot(reflect(-sun,normal),vec3(0.0,0.0,1.0))),54.0);
 color+=mix(vec3(0.36,0.67,0.79),vec3(0.66,0.88,0.91),uLight)*specular*(1.0-atlas.r)*0.34;
 color+=mint*atlas.g*(0.25+diffuse*0.22);
 color+=mint*atlas.b*0.20;
 vec2 grid=abs(fract(vec2(lon/(PI/12.0),lat/(PI/12.0))+0.5)-0.5);
 float line=1.0-smoothstep(0.003,0.009,min(grid.x,grid.y));
 color+=mint*line*0.033;
 float rim=pow(1.0-normal.z,3.0);
 color+=mint*rim*0.22*uGlow;
 color*=0.87+0.13*normal.z;
 float edge=1.0-smoothstep(1.0-1.8/uRadius,1.0,r);
 gl_FragColor=vec4(color,edge);
}`;
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(message||'Shader compile failed');}return shader;}
class WebGLSphere{
 constructor(canvas,onLost,onRestored){
  this.canvas=canvas;this.onLost=onLost;this.onRestored=onRestored;
  this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if(!this.gl)throw Error('WebGL unavailable');
  this.lost=e=>{e.preventDefault();this.contextLost=true;onLost?.();};
  this.restored=()=>{try{this.contextLost=false;this.init();if(this.image)this.setAtlas(this.image);onRestored?.();}catch{this.contextLost=true;onLost?.();}};
  canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored);
  this.init();
 }
 init(){
  const gl=this.gl,precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  const fragment=precision?.precision?FRAGMENT:FRAGMENT.replace('precision highp float;','precision mediump float;');
  const vertex=compile(gl,gl.VERTEX_SHADER,VERTEX),pixel=compile(gl,gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
  gl.attachShader(program,vertex);gl.attachShader(program,pixel);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(pixel);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const error=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw Error(error||'Shader link failed');}
  this.program=program;this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  this.location={};for(const name of ['uAtlas','uSize','uCenter','uRadius','uDpr','uAngles','uLight','uGlow'])this.location[name]=gl.getUniformLocation(program,name);
  this.position=gl.getAttribLocation(program,'aPosition');this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 }
 setAtlas(image){
  this.image=image;if(this.contextLost)return;
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 }
 resize(width,height){if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;}
 draw(scene){
  if(this.contextLost)return false;const gl=this.gl,l=this.location;
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(l.uAtlas,0);
  gl.uniform2f(l.uSize,scene.width,scene.height);gl.uniform2f(l.uCenter,scene.cx,scene.cy);gl.uniform1f(l.uRadius,scene.radius);gl.uniform1f(l.uDpr,scene.dpr);gl.uniform2f(l.uAngles,scene.yaw,scene.pitch);gl.uniform1f(l.uLight,scene.light?1:0);gl.uniform1f(l.uGlow,scene.glow??1);
  gl.drawArrays(gl.TRIANGLES,0,6);return true;
 }
 destroy(){const gl=this.gl;this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored);if(!this.contextLost){gl.deleteTexture(this.texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);}}
}
function inverseNormal(x,y,z,yaw,pitch){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),yy=y*cp+z*sp,zz=-y*sp+z*cp;return [x*cy+zz*sy,yy,-x*sy+zz*cy];}
function atlasUV(x,y,z){return [(Math.atan2(x,z)/(Math.PI*2)+.5)%1,.5-Math.asin(Math.max(-1,Math.min(1,y)))/Math.PI];}
class CanvasSphere{
 constructor(image){
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);this.atlas=ctx.getImageData(0,0,image.width,image.height).data;this.atlasWidth=image.width;this.atlasHeight=image.height;this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');
 }
 draw(ctx,scene){
  const size=Math.min(320,Math.max(160,Math.round(scene.radius*1.5))),key=[size,scene.yaw.toFixed(4),scene.pitch.toFixed(4),scene.light].join(':');
  if(key!==this.key){
   this.key=key;if(this.canvas.width!==size){this.canvas.width=size;this.canvas.height=size;this.normals=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++){const nx=(x+.5)/size*2-1,ny=1-(y+.5)/size*2,d=nx*nx+ny*ny;this.normals.push(d>1?null:[nx,ny,Math.sqrt(1-d)]);}}
   const pixels=this.ctx.createImageData(size,size),out=pixels.data,cy=Math.cos(scene.yaw),sy=Math.sin(scene.yaw),cp=Math.cos(scene.pitch),sp=Math.sin(scene.pitch);
   for(let index=0;index<this.normals.length;index++){
    const normal=this.normals[index];if(!normal)continue;const [x,y,z]=normal,yy=y*cp+z*sp,zz=-y*sp+z*cp,[u,v]=atlasUV(x*cy+zz*sy,yy,-x*sy+zz*cy),offset=(Math.min(this.atlasHeight-1,Math.floor(v*this.atlasHeight))*this.atlasWidth+Math.min(this.atlasWidth-1,Math.floor(u*this.atlasWidth)))*4,land=this.atlas[offset]/255,shore=this.atlas[offset+1]/255;
    const shade=.52+.72*Math.max(0,-.46*x+.59*y+.69*z),rim=(1-z)**3,base=scene.light?[92+land*(-42),168+land*(-8),189+land*(-44)]:[4+land*12,14+land*68,27+land*55];
    for(let c=0;c<3;c++)out[index*4+c]=Math.min(255,base[c]*shade+[35,110,104][c]*(shore*.6+rim*.2));out[index*4+3]=255;
   }
   this.ctx.putImageData(pixels,0,0);
  }
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(this.canvas,scene.cx-scene.radius,scene.cy-scene.radius,scene.radius*2,scene.radius*2);
 }
}
window.MikuEarthRenderer={WebGLSphere,CanvasSphere,inverseNormal,atlasUV,shaders:{vertex:VERTEX,fragment:FRAGMENT}};
})();
