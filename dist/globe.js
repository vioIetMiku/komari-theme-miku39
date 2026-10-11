/* Miku39 globe: local high-resolution coastlines, GPU light and continuous light trails. */
(()=>{
'use strict';
const PI=Math.PI,RAD=PI/180;
function vector(lat,lng){const a=lat*RAD,b=lng*RAD,c=Math.cos(a);return [c*Math.sin(b),Math.sin(a),c*Math.cos(b)];}
function initialPhase(uuid){let hash=2166136261;for(const ch of String(uuid))hash=Math.imul(hash^ch.charCodeAt(0),16777619);return (hash>>>0)/4294967296;}
const coasts=(window.MikuEarth?.coasts||[]).map(ring=>ring.map(([lng,lat])=>vector(lat,lng)));
function arcPoints(a,b){
 const u=vector(a.lat,a.lng),v=vector(b.lat,b.lng),dot=Math.max(-1,Math.min(1,u.reduce((s,n,i)=>s+n*v[i],0))),angle=Math.acos(dot),sn=Math.sin(angle),height=Math.min(.38,.06+angle*.115);
 let perpendicular;if(angle>PI-.001){perpendicular=v.map((n,j)=>n-dot*u[j]);let len=Math.hypot(...perpendicular);if(len<.00001){perpendicular=Math.abs(u[1])<.9?[-u[2],0,u[0]]:[0,-u[2],u[1]];len=Math.hypot(...perpendicular);}perpendicular=perpendicular.map(n=>n/len);}
 return Array.from({length:81},(_,i)=>{const t=i/80,scale=1.007+Math.sin(t*PI)*height;const p=perpendicular?u.map((n,j)=>n*Math.cos(angle*t)+perpendicular[j]*Math.sin(angle*t)):Math.abs(sn)>.001?u.map((n,j)=>(n*Math.sin((1-t)*angle)+v[j]*Math.sin(t*angle))/sn):u.map((n,j)=>n*(1-t)+v[j]*t);const len=Math.hypot(...p)||1;return p.map(n=>n/len*scale);});
}
function sampleArc(points,t){const at=Math.max(0,Math.min(1,t))*(points.length-1),i=Math.min(points.length-2,Math.floor(at)),f=at-i;return points[i].map((n,j)=>n+(points[i+1][j]-n)*f);}
function visible(point,cx,cy,radius){return point.z>=0||Math.hypot(point.x-cx,point.y-cy)>radius+.6;}
class TrafficGlobe{
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.routes=[];this.routeCache=new Map();this.markers=[];this.markerCache=new Map();this.markerGroupCache=new Map();this.pulse=0;this.yaw=104.1954*RAD;this.pitch=35.8617*RAD;this.zoom=1;
  this.options={motion:true,rotate:true,light:false,paused:false,rhythm:true,quality:'auto',glow:1};this.inView=true;this.lastFrame=0;this.animation=0;this.velocity={x:0,y:0};this.lastInteraction=0;this.stars=Array.from({length:55},(_,i)=>({x:initialPhase('x'+i),y:initialPhase('y'+i),size:i%9===0?1.2:.65}));
  this.setupSurface();
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.onReduced=()=>{if(this.reduced.matches){this.velocity={x:0,y:0};if(this.focusAnimation){this.yaw=this.focusAnimation.yaw;this.pitch=this.focusAnimation.pitch;this.focusAnimation=null;}}this.wake();};this.reduced.addEventListener('change',this.onReduced);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
  this.observer=new IntersectionObserver(([event])=>{this.inView=event.isIntersecting;if(this.inView)this.wake();else this.stop();},{threshold:0});this.observer.observe(canvas);
  this.onVisibility=()=>{if(document.hidden)this.stop();else this.wake();};document.addEventListener('visibilitychange',this.onVisibility);
  this.down=e=>{if(e.button&&e.button!==0)return;this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,time:performance.now(),moved:false};this.focusAnimation=null;this.velocity={x:0,y:0};this.lastInteraction=Date.now();canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');};
  this.move=e=>{
   if(this.drag){const now=performance.now(),dt=Math.max(8,now-this.drag.time),dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.yaw-=dx*.006;this.pitch=Math.max(-1.52,Math.min(1.52,this.pitch+dy*.006));this.velocity={x:-dx*.006/dt,y:dy*.006/dt};this.drag.moved ||= Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>4;Object.assign(this.drag,{x:e.clientX,y:e.clientY,time:now});this.lastInteraction=Date.now();this.wake();}
   else {const bounds=canvas.getBoundingClientRect();this.hover=this.pick(e.clientX-bounds.left,e.clientY-bounds.top);canvas.style.cursor=this.hover?'pointer':'grab';this.wake();}
  };
  this.up=e=>{if(!this.drag)return;const clicked=!this.drag.moved;this.drag=null;canvas.classList.remove('dragging');this.lastInteraction=Date.now();if(clicked&&e){const bounds=canvas.getBoundingClientRect(),marker=this.pick(e.clientX-bounds.left,e.clientY-bounds.top);if(marker)this.options.onSelect?.(marker.uuid,marker.members?.map(server=>server.uuid));}this.wake();};
  this.cancel=()=>{if(this.drag)this.velocity={x:0,y:0};this.drag=null;canvas.classList.remove('dragging');};
  this.leave=()=>{this.hover=null;canvas.style.cursor='grab';this.wake();};
  this.key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();this.lastInteraction=Date.now();this.velocity={x:0,y:0};if(e.key==='Home')this.reset();else{this.focusAnimation=null;this.yaw+=e.key==='ArrowLeft'?.12:e.key==='ArrowRight'?-.12:0;this.pitch=Math.max(-1.52,Math.min(1.52,this.pitch+(e.key==='ArrowDown'?.1:e.key==='ArrowUp'?-.1:0)));this.wake();}}};
  for(const [name,fn] of this.listeners())canvas.addEventListener(name,fn);
  this.resize();
 }
 listeners(){return [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel],['lostpointercapture',this.cancel],['pointerleave',this.leave],['keydown',this.key]];}
 setupSurface(){
  this.surface=document.createElement('canvas');this.surface.className='globe-surface';this.surface.setAttribute('aria-hidden','true');this.canvas.before(this.surface);
  try{this.renderer=new window.MikuEarthRenderer.WebGLSphere(this.surface,()=>{this.surface.hidden=true;this.wake();},()=>{this.surface.hidden=false;this.fallback=null;this.fallbackFailed=false;this.wake();});}catch{this.surface.hidden=true;this.renderer=null;}
  this.image=new Image();this.image.onload=()=>{if(this.destroyed)return;this.atlasImage=this.image;if(this.renderer)try{this.renderer.setAtlas(this.image);}catch{this.renderer.destroy();this.renderer=null;this.surface.hidden=true;}this.wake();};
  this.image.onerror=()=>{if(this.destroyed)return;this.imageFailed=true;this.surface.hidden=true;this.wake();};
  this.image.src=window.MIKU39_ASSETS?.['earth-atlas.webp']||`${window.MIKU39_ASSET_BASE||'./assets/'}earth-atlas.webp`;
 }
 resize(){
  const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  this.width=rect.width;this.height=rect.height;this.dpr=Math.min(this.options.quality==='high'?2.5:this.options.quality==='eco'?1.25:2,devicePixelRatio||1);
  const width=Math.round(rect.width*this.dpr),height=Math.round(rect.height*this.dpr);
  if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
  this.renderer?.resize(width,height);this.wake();
 }
 setData(routes,target,servers=routes){
  this.markerCache ||= new Map();this.markerGroupCache ||= new Map();
  const keep=new Set(),groups=new Map();this.markers=[];
  for(const source of servers){
   if(!Number.isFinite(source.lat)||!Number.isFinite(source.lng)||Math.abs(source.lat)>90||Math.abs(source.lng)>180)continue;
   const id=String(source.uuid);if(keep.has(id))continue;keep.add(id);
   let marker=this.markerCache.get(id);if(!marker){marker={uuid:id};this.markerCache.set(id,marker);}
   const key=source.lat.toFixed(6)+':'+source.lng.toFixed(6);
   if(marker.positionKey!==key){marker.position=vector(source.lat,source.lng);marker.positionKey=key;}
   Object.assign(marker,source);this.markers.push(marker);
   let group=groups.get(key);if(!group){group=this.markerGroupCache.get(key)||{key,position:marker.position};group.members=[];groups.set(key,group);}group.members.push(marker);
  }
  this.markerGroupCache=groups;this.markerGroups=[...groups.values()];
  for(const group of this.markerGroups){group.members.sort((a,b)=>String(a.uuid).localeCompare(String(b.uuid)));group.uuid=group.members[0].uuid;group.name=group.members.length===1?group.members[0].name:`${group.members[0].name} +${group.members.length-1}`;group.status=group.members.some(marker=>marker.status==='online')?'online':group.members.every(marker=>marker.status==='offline')?'offline':'unknown';}
  for(const id of this.markerCache.keys())if(!keep.has(id))this.markerCache.delete(id);
  this.routes=routes.map(source=>{
   const id=String(source.uuid),key=[source.lat,source.lng,target.lat,target.lng].join(':');keep.add(id);
   let route=this.routeCache.get(id);if(!route){route={phase:initialPhase(id)};this.routeCache.set(id,route);}
   if(route.pathKey!==key){route.points=arcPoints(source,target);route.pathKey=key;}
   Object.assign(route,source);return route;
  });for(const id of this.routeCache.keys())if(!keep.has(id))this.routeCache.delete(id);
  if(this.hover&&!this.markerGroups.includes(this.hover))this.hover=null;
  if(this.selectedUUID&&!keep.has(String(this.selectedUUID)))this.selectedUUID=null;
  this.target=target;this.wake();
 }
 setOptions(options){const quality=this.options.quality;Object.assign(this.options,options);if(this.width&&quality!==this.options.quality)this.resize();this.wake();}
 focusTarget(immediate=false){
  this.selectedUUID=null;this.focusPoint(this.target||{lat:35.8617,lng:104.1954},immediate);
 }
 focusServer(uuid,immediate=false){const marker=this.markerCache?.get(String(uuid));if(!marker)return false;this.selectedUUID=String(uuid);this.focusPoint(marker,immediate);return true;}
 focusPoint(target,immediate=false){
  let yaw=target.lng*RAD;while(yaw-this.yaw>PI)yaw-=2*PI;while(yaw-this.yaw<-PI)yaw+=2*PI;
  this.velocity={x:0,y:0};this.lastInteraction=Date.now();const pitch=target.lat*RAD;
  if(immediate||!this.options.motion||this.reduced.matches){this.yaw=yaw;this.pitch=pitch;this.focusAnimation=null;}
  else this.focusAnimation={fromYaw:this.yaw,fromPitch:this.pitch,yaw,pitch,time:0};this.wake();
 }
 reset(){this.zoom=1;this.focusTarget();}
 zoomBy(delta){this.zoom=Math.max(.75,Math.min(1.38,this.zoom+delta));this.lastInteraction=Date.now();this.wake();}
 stop(){cancelAnimationFrame(this.animation);this.animation=0;this.lastFrame=0;}
 wake(){if(this.animation||!this.ctx||!this.inView||document.hidden||this.destroyed)return;this.animation=requestAnimationFrame(t=>this.frame(t));}
 advance(dt){for(const route of this.routes){const intensity=Math.min(1,Math.log2(1+Math.max(0,route.speed)/1024)/18);route.phase=(route.phase+dt/(6500-intensity*2700))%1;}this.pulse=(this.pulse+dt/4200)%1;}
 frame(t){
  this.animation=0;if(!this.ctx||!this.inView||document.hidden||this.destroyed)return;
  const moving=this.options.motion&&!this.reduced.matches&&!this.options.paused,frameMs=this.options.quality==='eco'||!this.renderer||this.renderer.contextLost?64:32;
  if(this.lastFrame&&t-this.lastFrame<frameMs){this.wake();return;}const dt=this.lastFrame?Math.min(80,t-this.lastFrame):0;this.lastFrame=t;
  if(moving){
   this.advance(dt);
   if(this.focusAnimation){const a=this.focusAnimation;a.time+=dt;const t=1-(1-Math.min(1,a.time/900))**3;this.yaw=a.fromYaw+(a.yaw-a.fromYaw)*t;this.pitch=a.fromPitch+(a.pitch-a.fromPitch)*t;if(a.time>=900)this.focusAnimation=null;}
   else if(!this.drag){const decay=Math.exp(-dt/260);this.yaw+=this.velocity.x*dt;if(Math.abs(this.velocity.y)>.00001)this.pitch=Math.max(-1.52,Math.min(1.52,this.pitch+this.velocity.y*dt));this.velocity.x*=decay;this.velocity.y*=decay;if(this.options.rotate&&Date.now()-this.lastInteraction>5000)this.yaw+=dt*.000026;}
  }else if(this.focusAnimation){this.yaw=this.focusAnimation.yaw;this.pitch=this.focusAnimation.pitch;this.focusAnimation=null;}
  this.draw();if(moving&&(this.options.rotate||this.routes.length||this.focusAnimation||Math.abs(this.velocity.x)+Math.abs(this.velocity.y)>.00001))this.wake();
 }
 project(point){const [x,y,z]=point,cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),xx=x*cy-z*sy,zz=x*sy+z*cy;return {x:this.cx+xx*this.radius,y:this.cy-(y*cp-zz*sp)*this.radius,z:y*sp+zz*cp};}
 isVisible(point){return visible(point,this.cx,this.cy,this.radius);}
 stroke(points,color,width=1){const ctx=this.ctx;ctx.beginPath();let drawing=false;for(const point of points){const projected=this.project(point);if(!this.isVisible(projected)){drawing=false;continue;}if(drawing)ctx.lineTo(projected.x,projected.y);else ctx.moveTo(projected.x,projected.y);drawing=true;}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 pick(x,y){if(!this.radius)return null;let found=null,distance=13;for(const group of this.markerGroups||[]){const point=this.project(group.position);if(point.z<.06)continue;const delta=Math.hypot(point.x-x,point.y-y);if(delta<distance){distance=delta;found=group;}}return found;}
 drawStage(){
  const ctx=this.ctx,{light}=this.options,R=this.radius;
  for(const star of this.stars){const x=star.x*this.width,y=star.y*this.height;if(Math.hypot(x-this.cx,y-this.cy)<R*1.15||y<55||y>this.height-60)continue;ctx.fillStyle=light?'#399a9c38':'#94d8e350';ctx.beginPath();ctx.arc(x,y,star.size,0,2*PI);ctx.fill();}
  const y=Math.min(this.height-53,this.cy+R*1.15);ctx.save();ctx.strokeStyle=light?'#21989135':'#65dfd831';ctx.lineWidth=.75;
  for(const scale of [1,1.14]){ctx.beginPath();ctx.ellipse(this.cx,y,R*scale,R*.105,0,0,PI*2);ctx.stroke();}
  for(let i=0;i<24;i++){const a=i*PI/12,active=i===Math.floor(this.pulse*24)&&this.options.rhythm;ctx.strokeStyle=active?(light?'#6d5eac80':'#e6a1dc80'):(light?'#21989135':'#65dfd825');ctx.beginPath();ctx.moveTo(this.cx+Math.cos(a)*R*1.04,y+Math.sin(a)*R*.11);ctx.lineTo(this.cx+Math.cos(a)*R*1.10,y+Math.sin(a)*R*.116);ctx.stroke();}ctx.restore();
 }
 drawBase(scene){
  if(this.renderer&&!this.imageFailed&&this.renderer.draw(scene))return;
  if(this.atlasImage&&!this.fallbackFailed){try{this.fallback ||= new window.MikuEarthRenderer.CanvasSphere(this.atlasImage);this.fallback.draw(this.ctx,scene);return;}catch{this.fallbackFailed=true;}}
  const ctx=this.ctx,R=this.radius,ocean=ctx.createRadialGradient(this.cx-R*.4,this.cy-R*.6,0,this.cx,this.cy,R*1.2);ocean.addColorStop(0,scene.light?'#c4e9e8':'#154451');ocean.addColorStop(1,scene.light?'#8bc4cd':'#051b2b');ctx.fillStyle=ocean;ctx.beginPath();ctx.arc(this.cx,this.cy,R,0,2*PI);ctx.fill();
  for(const ring of coasts)this.stroke(ring,scene.light?'#319b9270':'#86ecde60',.6);
 }
 drawRoutes(){
  const ctx=this.ctx,{light}=this.options;
  for(const route of this.routes){
   const intensity=Math.min(1,Math.log2(1+Math.max(0,route.speed)/1024)/18),selected=this.selectedUUID===String(route.uuid)||this.hover?.members?.some(server=>server.uuid===route.uuid),start=this.project(route.points[0]),end=this.project(route.points.at(-1));
   const gradient=ctx.createLinearGradient(start.x,start.y,end.x,end.y);gradient.addColorStop(0,light?'#12968770':'#59dac45c');gradient.addColorStop(.55,light?'#7466b270':'#aaa0ff64');gradient.addColorStop(1,light?'#c25b9070':'#ffa0cc80');this.stroke(route.points,gradient,selected?2:.7+intensity*.6);
   const trains=this.options.quality==='eco'?1:3;
   for(let train=0;train<trains;train++){
    const phase=(route.phase+train/trains)%1,point=this.project(sampleArc(route.points,phase)),trail=Array.from({length:9},(_,i)=>sampleArc(route.points,Math.max(0,phase-.115+i*.115/8)));
    ctx.globalAlpha=.3+.55*phase;this.stroke(trail,light?'#35afaa':'#adfff1',1.5+intensity*.4);ctx.globalAlpha=1;
    if(this.isVisible(point)){const color=phase>.78?(light?'#b7528a':'#ffb2d5'):(light?'#149d8c':'#a6fff0');ctx.shadowColor=color;ctx.shadowBlur=8;ctx.fillStyle=color;ctx.beginPath();ctx.arc(point.x,point.y,1.5+intensity*.6,0,PI*2);ctx.fill();ctx.shadowBlur=0;}
   }
  }
 }
 drawMarkers(){
  const ctx=this.ctx,light=this.options.light,visibleGroups=[];
  for(const group of this.markerGroups||[]){
   const point=this.project(group.position);if(point.z<.04)continue;
   const selected=group.members.some(server=>String(server.uuid)===this.selectedUUID)||this.hover===group;
   const color=selected?(light?'#7654ab':'#e0c1ff'):group.status==='online'?(light?'#0b857f':'#9deedb'):group.status==='offline'?(light?'#b0567c':'#f5a2c6'):(light?'#907127':'#e7c481');
   ctx.save();ctx.strokeStyle=color;ctx.fillStyle=light?'#ebf8f3':'#0b2d39';ctx.lineWidth=selected?1.7:1.1;
   const radius=group.members.length>1?7:selected?4.5:3;ctx.beginPath();ctx.arc(point.x,point.y,radius,0,PI*2);ctx.fill();ctx.stroke();
   if(group.members.length>1){ctx.fillStyle=color;ctx.font='600 8px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(group.members.length>99?'99+':String(group.members.length),point.x,point.y);}
   else if(group.status==='online'){ctx.fillStyle=color;ctx.beginPath();ctx.arc(point.x,point.y,1.4,0,PI*2);ctx.fill();}
   ctx.restore();visibleGroups.push({group,point,selected,color});
  }
  ctx.font='11px system-ui,sans-serif';visibleGroups.sort((a,b)=>Number(b.selected)-Number(a.selected)||b.point.z-a.point.z);
  const boxes=[];
  for(const {group,point,selected,color} of visibleGroups){
   if(boxes.length>=8&&!selected)continue;
   const marker=group.members.find(server=>String(server.uuid)===this.selectedUUID),text=marker?marker.name:group.name,short=[...String(text)].slice(0,18).join(''),width=Math.min(200,ctx.measureText(short).width)+16;
   const x=Math.max(8,Math.min(this.width-width-8,point.x+11)),y=Math.max(65,Math.min(this.height-55,point.y-10)),box={x,y:y-15,width,height:23};
   if(!selected&&boxes.some(b=>box.x<b.x+b.width&&box.x+box.width>b.x&&box.y<b.y+b.height&&box.y+box.height>b.y))continue;
   this.label(x,y,short,color);boxes.push(box);
  }
 }
 drawTarget(){
  if(!this.target)return;const ctx=this.ctx,point=this.project(vector(this.target.lat,this.target.lng));if(point.z<=0)return;const color=this.options.light?'#a9508c':'#ffb4d7';
  ctx.strokeStyle=this.options.light?'#b55c9545':'#f7a2d250';ctx.lineWidth=1;ctx.beginPath();ctx.arc(point.x,point.y,9+this.pulse*12,0,PI*2);ctx.stroke();ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(point.x,point.y,4.5,0,PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(point.x+5,point.y-5);ctx.lineTo(point.x+17,point.y-20);ctx.lineTo(point.x+32,point.y-20);ctx.stroke();this.label(point.x+30,point.y-23,this.target.label||this.target.name,color,true);
 }
 draw(){
  if(!this.width||!this.height)return;const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);this.cx=this.width*.50;this.cy=this.height*.47;this.radius=Math.min(this.width*.325,this.height*.335)*this.zoom;
  this.drawBase({width:this.width,height:this.height,cx:this.cx,cy:this.cy,radius:this.radius,dpr:this.dpr,yaw:this.yaw,pitch:this.pitch,light:this.options.light,glow:this.options.glow});this.drawStage();this.drawRoutes();this.drawMarkers();this.drawTarget();
  if(this.hover){const point=this.project(this.hover.position);if(point.z>.02)this.label(point.x+10,point.y-12,this.hover.name,this.options.light?'#466b76':'#e7fffa');}
 }
 label(x,y,text,color,target=false){const ctx=this.ctx;ctx.font=`${target?'600 ':''}11px system-ui,sans-serif`;text=String(text||'');while(text.length>1&&ctx.measureText(text).width>Math.min(240,this.width-32))text=text.slice(0,-2)+'…';const width=ctx.measureText(text).width;x=Math.max(8,Math.min(this.width-width-15,x));y=Math.max(63,Math.min(this.height-55,y));ctx.fillStyle=this.options.light?'#e7f6f2ee':'#092534e8';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-6,y-14,width+12,22,6);else ctx.rect(x-6,y-14,width+12,22);ctx.fill();ctx.strokeStyle=this.options.light?'#30a9a338':'#80eada38';ctx.lineWidth=.7;ctx.stroke();ctx.fillStyle=color;ctx.fillText(text,x,y+1);}
 destroy(){this.destroyed=true;this.stop();this.resizeObserver.disconnect();this.observer.disconnect();this.reduced.removeEventListener('change',this.onReduced);document.removeEventListener('visibilitychange',this.onVisibility);for(const [event,fn] of this.listeners())this.canvas.removeEventListener(event,fn);this.image.onload=null;this.image.onerror=null;this.renderer?.destroy();this.surface.remove();}
}
window.MikuTrafficGlobe=TrafficGlobe;
})();
