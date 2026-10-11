// Browser image/transaction contracts for background tests; this is not an image decoder.
export function backgroundBrowser(records={record:null,failWrites:false}){
 const revoked=new Set(),pending=new Map(),broken=new Set(),files=new Map();let counter=0;
 class ImageURL extends URL{
  static createObjectURL(file){const url='blob:test-'+(++counter);files.set(url,file);return url;}
  static revokeObjectURL(url){revoked.add(url);files.delete(url);}
 }
 class FixtureImage{
  naturalWidth=1920;naturalHeight=1080;
  set src(url){
   this._src=url;if(!url)return;
   const finish=()=>{if(broken.has(url)||files.get(url)?.name==='broken.png')this.onerror?.();else this.onload?.();};
   if(url.includes('pending'))pending.set(url,finish);else queueMicrotask(finish);
  }
  get src(){return this._src;}
 }
 const indexedDB={open(name){
  records.dbName=name;const request={};
  queueMicrotask(()=>{
   request.result={objectStoreNames:{contains:()=>true},close(){},transaction(_name,mode){
    let stopped=false;
    const tx={abort(){stopped=true;queueMicrotask(()=>tx.onabort?.());},objectStore(){return {get(){return operation(null);},put(record){return operation(record);}};}};
    function operation(record){const op={};queueMicrotask(()=>{
     if(stopped)return;
     if(mode==='readwrite'&&records.failWrites){tx.onerror?.();return;}
     op.result=record||records.record;op.onsuccess?.();
     queueMicrotask(()=>{if(stopped)return;if(mode==='readwrite')records.record=record;tx.oncomplete?.();});
    });return op;}
    return tx;
   }};
   request.onsuccess?.();
  });return request;
 }};
 return {browser:{URL:ImageURL,Image:FixtureImage,indexedDB},records,revoked,pending,broken};
}
export const imageFile=(name='my-background.webp',size=1024,type='image/webp')=>({name,size,type});
