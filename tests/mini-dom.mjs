// Minimal owned-markup DOM contract for reconciliation tests, not a browser renderer.
const HTML='http://www.w3.org/1999/xhtml',SVG='http://www.w3.org/2000/svg';
const VOID=new Set(['AREA','BASE','BR','COL','EMBED','HR','IMG','INPUT','LINK','META','PARAM','SOURCE','TRACK','WBR']);
const decode=s=>s.replace(/&(amp|lt|gt|quot|apos|#39|#\d+);/g,(_,n)=>({'amp':'&','lt':'<','gt':'>','quot':'"','apos':"'",'#39':"'"}[n]??String.fromCharCode(Number(n.slice(1)))));
export class MiniNode{
 constructor(document,type,name,namespace=null,value=null){this.ownerDocument=document;this.nodeType=type;this.nodeName=name;this.namespaceURI=namespace;this._value=value;this.childNodes=[];this.parentNode=null;this._attrs=new Map();}
 get nodeValue(){return this._value;}
 set nodeValue(value){if(this._value!==value)this.ownerDocument.mutations.push({kind:'text',node:this});this._value=value;}
 get firstChild(){return this.childNodes[0]||null;}
 get nextSibling(){const siblings=this.parentNode?.childNodes;return siblings?siblings[siblings.indexOf(this)+1]||null:null;}
 get attributes(){return [...this._attrs].map(([name,value])=>({name,value}));}
 getAttribute(name){return this._attrs.get(name)??null;}
 hasAttribute(name){return this._attrs.has(name);}
 setAttribute(name,value){this._attrs.set(name,String(value));this.ownerDocument.mutations.push({kind:'attribute',node:this,name});}
 removeAttribute(name){this._attrs.delete(name);this.ownerDocument.mutations.push({kind:'attribute',node:this,name});}
 insertBefore(node,before){
  if(node===before)return node;
  if(node.parentNode)node.parentNode.removeChild(node);
  const index=before?this.childNodes.indexOf(before):this.childNodes.length;
  if(index<0)throw Error('Invalid reference child');
  this.childNodes.splice(index,0,node);node.parentNode=this;
  this.ownerDocument.mutations.push({kind:'insert',node,parent:this});return node;
 }
 appendChild(node){return this.insertBefore(node,null);}
 removeChild(node){const i=this.childNodes.indexOf(node);if(i<0)throw Error('Missing child');this.childNodes.splice(i,1);node.parentNode=null;this.ownerDocument.mutations.push({kind:'remove',node,parent:this});return node;}
 cloneNode(deep){const clone=new MiniNode(this.ownerDocument,this.nodeType,this.nodeName,this.namespaceURI,this.nodeValue);clone._attrs=new Map(this._attrs);clone._controlValue=this._controlValue;if(deep)for(const child of this.childNodes)clone.appendChild(child.cloneNode(true));return clone;}
 get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(value){if(this.nodeType===3){this.nodeValue=String(value);return;}for(const node of [...this.childNodes])this.removeChild(node);if(value!=='')this.appendChild(this.ownerDocument.createTextNode(String(value)));}
 get value(){if(this._controlValue!==undefined)return this._controlValue;if(this.nodeName==='SELECT'){const options=this.querySelectorAll('option');const selected=options.find(n=>n.hasAttribute('selected'))||options[0];return selected?.getAttribute('value')??selected?.textContent??'';}return this.getAttribute('value')??'';}
 set value(value){this._controlValue=String(value);}
 get type(){return this.getAttribute('type')??'';}
 get classList(){return {contains:n=>(this.getAttribute('class')||'').split(/\s+/).includes(n)};}
 get dataset(){return Object.fromEntries([...this._attrs].filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));}
 querySelectorAll(selector){const found=[];const matches=node=>{
  if(node.nodeType!==1)return false;
  if(selector.startsWith('.'))return node.classList.contains(selector.slice(1));
  if(selector.startsWith('#'))return node.getAttribute('id')===selector.slice(1);
  const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(attr)return attr[2]===undefined?node.hasAttribute(attr[1]):node.getAttribute(attr[1])===attr[2];
  return node.nodeName.toLowerCase()===selector.toLowerCase();
 };const visit=node=>{for(const child of node.childNodes){if(matches(child))found.push(child);visit(child);}};visit(this);return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
export class MiniDocument{
 constructor(){this.mutations=[];}
 createTextNode(value){return new MiniNode(this,3,'#text',null,value);}
 createElement(name){
  const node=new MiniNode(this,1,name.toUpperCase(),HTML);
  if(name==='template'){
   node.content=new MiniNode(this,11,'#document-fragment');
   Object.defineProperty(node,'innerHTML',{set:markup=>{node.content=this.parse(markup);}});
  }
  return node;
 }
 parse(markup){
  const fragment=new MiniNode(this,11,'#document-fragment'),stack=[fragment];
  for(const token of markup.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('<!--')||token.startsWith('<!'))continue;
   if(token.startsWith('</')){stack.pop();continue;}
   if(token.startsWith('<')){
    const name=token.match(/^<([\w-]+)/)[1],parent=stack.at(-1),namespace=name==='svg'||parent.namespaceURI===SVG?SVG:HTML;
    const node=new MiniNode(this,1,namespace===SVG?name:name.toUpperCase(),namespace);
    const body=token.slice(name.length+1,-1).replace(/\/$/,'');
    for(const match of body.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))node._attrs.set(match[1],decode(match[2]??match[3]??match[4]??''));
    parent.appendChild(node);
    if(!VOID.has(node.nodeName)&&!token.endsWith('/>'))stack.push(node);
   }else stack.at(-1).appendChild(this.createTextNode(decode(token)));
  }
  return fragment;
 }
 reset(){this.mutations=[];}
}
