/* Miku39 custom backgrounds: validate images and persist local files per browser. */
(()=>{
'use strict';
const MAX_BYTES=10*1024*1024;
const TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif']);
const aborted=()=>new DOMException('背景选择已取消','AbortError');
function normalizeURL(value){
 if(typeof value!=='string'||!value.trim()||value.length>4096)return null;
 try{const url=new URL(value.trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
function validateFile(file){
 if(!file||!Number.isFinite(file.size)||file.size<=0)throw Error('请选择一张有效图片。');
 if(file.size>MAX_BYTES)throw Error('图片不能超过 10 MiB，请换一张较小的图片。');
 if(!TYPES.has(file.type)&&!(file.type===''&&/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name||'')))throw Error('支持 JPG、PNG、WebP、GIF 和 AVIF 图片。');
 return file;
}
function loadImage(url,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(aborted());return;}
  const img=new Image();let finished=false;
  const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);img.onload=img.onerror=null;signal?.removeEventListener('abort',cancel);if(error){img.src='';reject(error);}else resolve(url);};
  const cancel=()=>finish(aborted());
  const timer=setTimeout(()=>finish(Error('图片加载超时，请检查链接或稍后重试。')),15000);
  img.onload=()=>finish(img.naturalWidth>0&&img.naturalHeight>0?null:Error('图片无法读取，请选择其他图片。'));
  img.onerror=()=>finish(Error('图片加载失败，请检查图片是否有效、链接是否可直接访问。'));
  signal?.addEventListener('abort',cancel,{once:true});img.src=url;
 });
}
async function loadURL(value,signal){
 const url=normalizeURL(value);if(!url)throw Error('请输入完整的 http:// 或 https:// 图片直链。');
 if(location.protocol==='https:'&&url.startsWith('http:'))throw Error('当前页面使用 HTTPS，请使用 https:// 图片链接。');
 return loadImage(url,signal);
}
function openDB(signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(aborted());return;}
  if(typeof indexedDB==='undefined'){reject(Error('当前浏览器无法保存本地图片，请改用图片链接。'));return;}
  let request,done=false;
  const finish=(error,db)=>{if(done){db?.close();return;}done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(error):resolve(db);};
  const cancel=()=>finish(aborted());
  const timer=setTimeout(()=>finish(Error('图片存储暂时不可用，请关闭其他页面后重试。')),5000);
  signal?.addEventListener('abort',cancel,{once:true});
  try{request=indexedDB.open('miku39.backgrounds.v1',1);}catch{finish(Error('当前浏览器无法保存本地图片，请改用图片链接。'));return;}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images');};
  request.onsuccess=()=>finish(null,request.result);
  request.onerror=()=>finish(Error('图片存储暂时不可用，请重试或改用图片链接。'));
  request.onblocked=()=>finish(Error('图片存储被其他页面占用，请关闭其他页面后重试。'));
 });
}
async function localRecord(record,signal){
 const db=await openDB(signal);
 return new Promise((resolve,reject)=>{
  let tx,result,done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);db.close();error?reject(error):resolve(result);};
  const cancel=()=>{try{tx?.abort();}catch{}finish(aborted());};
  const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(Error('图片保存超时，请重试。'));},5000);
  if(signal?.aborted){cancel();return;}
  signal?.addEventListener('abort',cancel,{once:true});
  try{
   tx=db.transaction('images',record?'readwrite':'readonly');
   const store=tx.objectStore('images'),request=record?store.put(record,'local'):store.get('local');
   request.onsuccess=()=>{result=record||request.result||null;};
   tx.oncomplete=()=>finish();
   tx.onerror=tx.onabort=()=>finish(signal?.aborted?aborted():Error('浏览器无法保存或读取图片，请检查存储空间或改用图片链接。'));
  }catch{finish(Error('浏览器无法保存或读取图片，请改用图片链接。'));}
 });
}
async function storeLocal(file,signal){
 validateFile(file);const url=URL.createObjectURL(file);
 try{await loadImage(url,signal);await localRecord({blob:file,name:String(file.name||'本地图片').slice(0,256)},signal);return {url,name:String(file.name||'本地图片').slice(0,256)};}
 catch(error){URL.revokeObjectURL(url);throw error;}
}
async function readLocal(signal){
 const record=await localRecord(null,signal);if(!record)return null;
 validateFile(record.blob);const url=URL.createObjectURL(record.blob);
 try{await loadImage(url,signal);return {url,name:typeof record.name==='string'?record.name.slice(0,256):'本地图片'};}
 catch(error){URL.revokeObjectURL(url);throw error;}
}
window.MikuBackgrounds={normalizeURL,validateFile,loadURL,storeLocal,readLocal};
})();
