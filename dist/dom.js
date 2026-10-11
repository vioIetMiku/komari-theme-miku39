/* Reconcile theme-owned markup without replacing live cards, SVGs or images. */
(()=>{
'use strict';
const KEY_ATTRIBUTES=['id','data-render-key','data-node','data-node-row','data-ping-task-id','data-group','data-detail-tab','data-ping-task','data-mascot-id','data-wallpaper'];
function key(node){
 if(node.nodeType!==1)return null;
 for(const name of KEY_ATTRIBUTES){const value=node.getAttribute(name);if(value!==null)return name+':'+value;}
 return null;
}
function compatible(a,b){return a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&a.namespaceURI===b.namespaceURI;}
function patchNode(current,next){
 if(current.nodeType===3||current.nodeType===8){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
 if(current.nodeType!==1)return;
 for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
 for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
 // A canvas owns its drawing surface; HTML refreshes must never reset it.
 if(current.nodeName!=='CANVAS')patchChildren(current,next);
 if(current.nodeName==='INPUT'){
  if(next.hasAttribute('value')&&current.value!==next.getAttribute('value'))current.value=next.getAttribute('value');
  if(['checkbox','radio'].includes(current.type))current.checked=next.hasAttribute('checked');
 }
 if(current.nodeName==='SELECT'&&current.value!==next.value)current.value=next.value;
}
function patchChildren(parent,next){
 const previous=[...parent.childNodes],keyed=new Map(),used=new Set();
 for(const node of previous){const id=key(node);if(id!==null)keyed.set(id,node);}
 let cursor=parent.firstChild;
 for(const proposed of [...next.childNodes]){
  const id=key(proposed);
  let current=id===null?null:keyed.get(id);
  if(current&&(!compatible(current,proposed)||used.has(current)))current=null;
  if(id===null){
   if(cursor&&!used.has(cursor)&&key(cursor)===null&&compatible(cursor,proposed))current=cursor;
   else current=previous.find(n=>!used.has(n)&&key(n)===null&&compatible(n,proposed));
  }
  if(current){used.add(current);patchNode(current,proposed);}
  else current=proposed.cloneNode(true);
  if(current!==cursor)parent.insertBefore(current,cursor);
  cursor=current.nextSibling;
 }
 for(const node of previous)if(!used.has(node)&&node.parentNode===parent)parent.removeChild(node);
}
function patchMarkup(element,markup){
 if(!element)return;
 const template=element.ownerDocument.createElement('template');
 template.innerHTML=markup;
 patchChildren(element,template.content);
}
window.MikuDOM={patchMarkup,patchChildren};
})();
