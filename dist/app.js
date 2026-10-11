/* Miku39 v1.4.5 | MIT (code); see ASSETS.md for artwork */
(()=>{
'use strict';
// domain.js
/** Pure normalization and formatting; no browser or network dependency. */
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
function numeric(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function capacity(...values) {
  for(const value of values){const n=numeric(value);if(n!==null&&n>0)return n;}
  return null;
}
function nonnegative(value){const n=numeric(value);return n!==null&&n>=0?n:null;}
function parseTime(value){
  if(typeof value!=='string'||!value.trim())return null;
  const text=value.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/,'$1T$2').replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:?\d{2}$)/,'$1');
  const time=Date.parse(text);return Number.isFinite(time)?time:null;
}
function percent(used, total) {
  const u = numeric(used), t = numeric(total);
  return u === null || t === null || t <= 0 ? null : clamp(u / t * 100);
}
function bytes(value, speed = false) {
  const n = numeric(value);
  if (n === null || n < 0) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = n === 0 ? 0 : Math.min(5, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v.toFixed(i === 0 ? 0 : v < 10 ? 2 : 1)} ${units[i]}${speed ? '/s' : ''}`;
}
const pct = n => numeric(n) === null ? '—' : `${clamp(Number(n)).toFixed(1)}%`;
function uptime(value) {
  const n = numeric(value);
  if (n === null || n < 0) return '—';
  const d = Math.floor(n / 86400), h = Math.floor(n % 86400 / 3600), m = Math.floor(n % 3600 / 60);
  return d > 0 ? `${d}天 ${h}时` : h > 0 ? `${h}时 ${m}分` : `${m}分钟`;
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const FLAG_CODES=new Set(["AE", "AM", "AR", "AT", "AU", "BD", "BE", "BG", "BR", "CA", "CH", "CL", "CN", "CO", "CR", "CU", "CZ", "DE", "DK", "EC", "EE", "ES", "FI", "FR", "GB", "GE", "GR", "HK", "HU", "ID", "IE", "IL", "IN", "IS", "IT", "JP", "KR", "KZ", "LA", "LT", "LU", "LV", "MC", "MM", "MO", "MX", "MY", "NG", "NL", "NO", "NZ", "PA", "PE", "PH", "PK", "PL", "PT", "RO", "RU", "SE", "SG", "TH", "TR", "TW", "UA", "US", "VE", "VN", "ZA"]);
function flag(region) {
  const code=typeof region==='object'?window.MikuRegions.nodeCountry(region):window.MikuRegions.resolveCountry(region);
  const name=window.MikuRegions.countryName(code);
  return FLAG_CODES.has(code)?`<img class="country-flag" src="${asset('flags/'+code.toLowerCase()+'.svg')}" width="30" height="20" alt="${escapeHTML(name)}国旗" title="${escapeHTML(name)} · ${code}">`:`<span class="country-fallback" title="${escapeHTML(name)}">${code||'◎'}</span>`;
}

function trafficUsage(node, report) {
  if (!report) return null;
  const up = nonnegative(report.network?.totalUp), down = nonnegative(report.network?.totalDown);
  if(node.traffic_limit_type==='up')return up;
  if(node.traffic_limit_type==='down')return down;
  if (up === null || down === null) return null;
  return ({ up, down, sum: up + down, min: Math.min(up, down), max: Math.max(up, down) })[node.traffic_limit_type || 'max'] ?? Math.max(up, down);
}
function normalizeNodes(data) {
  if (!Array.isArray(data)) throw new Error('服务器接口未返回数组');
  const seen = new Set();
  return data.filter(n => n && typeof n.uuid === 'string' && !seen.has(n.uuid) && seen.add(n.uuid))
    .map(n => ({ ...n, name: n.name || '未命名服务器', group: n.group || '未分组', tags: Array.isArray(n.tags) ? n.tags : String(n.tags || '').split(';').filter(Boolean) }))
    .sort((a, b) => (numeric(a.weight) || 0) - (numeric(b.weight) || 0) || a.name.localeCompare(b.name));
}
function normalizeSnapshot(payload) {
  if (!payload || payload.status === 'error') throw new Error(payload?.message || '实时数据无效');
  const body = payload.data && Array.isArray(payload.data.online) ? payload.data : payload;
  if (!Array.isArray(body.online) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new Error('不支持的实时数据结构');
  const reports = Object.create(null);
  for (const [uuid, raw] of Object.entries(body.data)) {
    const report = Array.isArray(raw) ? raw.at(-1) : raw;
    if (report && typeof report === 'object') reports[uuid] = report;
  }
  return { online: new Set(body.online.filter(x => typeof x === 'string')), reports };
}
function nodeState(uuid, snapshot, connection) {
  if (!snapshot || !['live', 'demo'].includes(connection)) return 'unknown';
  return snapshot.online.has(uuid) ? 'online' : 'offline';
}
function pingStats(records) {
  const measured = records.map(r => numeric(r.value)).filter(v => v !== null);
  const valid = measured.filter(v => v >= 0).sort((a, b) => a - b);
  return {
    average: valid.length ? valid.reduce((s, n) => s + n, 0) / valid.length : null,
    p95: valid.length ? valid[Math.max(0, Math.ceil(valid.length * .95) - 1)] : null,
    loss: measured.length ? measured.filter(v => v < 0).length / measured.length * 100 : null,
    count: measured.length
  };
}
function recordSeries(records, field) {
  return records.filter(r=>r&&typeof r==='object').map(r=>({record:r,time:parseTime(r.time||r.updated_at)})).filter(r=>r.time!==null).sort((a,b)=>a.time-b.time)
    .map(({record,time})=>({time,value:numeric(field(record))}));
}
function resourceSeries(records,kind,node,report){
  const totalKey=kind==='ram'?'mem_total':'disk_total';
  return recordSeries(records,sample=>percent(nonnegative(sample[kind]),capacity(sample[kind+'_total'],node[totalKey],report?.[kind]?.total)));
}
function expiryTime(value){const time=parseTime(value);return time!==null&&new Date(time).getUTCFullYear()>1?time:null;}
function expiryDate(value){const time=expiryTime(value);return time===null?'未设置':new Date(time).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});}
function expiryText(value) {
  const time=expiryTime(value);if(time===null)return '未设置';
  const remaining=time-Date.now();if(remaining<=0){const days=Math.floor(-remaining/86400000);return days?`已到期 ${days}天`:'已到期';}
  return remaining<86400000?'24 小时内到期':`${Math.ceil(remaining/86400000)}天后到期`;
}
function priceText(node){
  const price=numeric(node.price);if(price===-1)return '免费';if(price===null||price<=0)return '未设置';
  const amount=price.toLocaleString('zh-CN',{maximumFractionDigits:4}),cycle=capacity(node.billing_cycle),currency=String(node.currency||'').trim();
  return `${currency?currency+' ':''}${amount}${cycle?' / '+cycle+'天':' · 周期未设置'}${currency?'':' · 币种未设置'}`;
}
function safeRead(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function parseGlobeLabel(value){
  if(typeof value!=='string'||/[\u0000-\u001f\u007f]/u.test(value))return null;
  const name=value.trim();return Array.from(name).length<=32?name:null;
}
function normalizeGlobeLabels(value){
  const labels=Object.create(null);
  if(!value||typeof value!=='object'||Array.isArray(value))return labels;
  for(const [uuid,valueName] of Object.entries(value)){
    const name=parseGlobeLabel(valueName);
    if(uuid.length>0&&uuid.length<=256&&!/[\u0000-\u001f\u007f]/u.test(uuid)&&name)labels[uuid]=name;
  }
  return labels;
}

// icons.js
// A deliberately small, consistent stroke icon system. Decorative art is raster.
const ICON_PATHS = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M12 6.5h5M12 17.5h5"/>',
  pulse: '<path d="M2 12h4l3-8 5 16 3-8h5"/>',
  network: '<circle cx="12" cy="5" r="3"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m13 6 5 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  memory: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4m5-4v4m5-4v4M7 18v3m5-3v3m5-3v3"/>',
  disk: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 14h18m-5 3h.01m-4 0h.01"/>',
  up: '<path d="m6 10 6-6 6 6M12 4v16"/>',
  down: '<path d="m6 14 6 6 6-6M12 20V4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  play: '<path d="m7 4 14 8-14 8z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
};
function icon(name, extra = '') {
  return `<svg class="icon ${extra}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.info}</svg>`;
}

// demo.js
// Demo is explicit and deterministic. It is never used as a failed-API fallback.
const GIB = 1024 ** 3;
const DEMO_SEED = [
  ['tokyo-01','东京 · 葱葱一号','JP','亚太','AMD EPYC 7B13',4,8,160,24.6,42.8,31.2,26.4,11.7,'Ubuntu 24.04','premium;production'],
  ['singapore-02','新加坡 · 夏日回响','SG','亚太','Intel Xeon Platinum',2,4,80,12.8,35.4,21.6,8.2,4.6,'Debian 12','edge;ssd'],
  ['hongkong-03','香港 · 未来之声','HK','亚太','AMD Ryzen 9 7950X',4,8,100,67.2,72.6,58.4,42.6,18.1,'Ubuntu 24.04','production;high-load'],
  ['frankfurt-04','法兰克福 · 星屑旋律','DE','欧洲','AMD EPYC 7543',2,4,80,8.4,27.1,18.3,5.8,2.9,'Debian 12','edge;backup'],
  ['losangeles-05','洛杉矶 · 39号电台','US','美洲','AMD EPYC 7763',4,8,160,19.7,46.2,37.4,16.7,7.6,'Rocky Linux 9','production;ssd'],
  ['osaka-06','大阪 · 休止符','JP','亚太','Intel Xeon E5-2697',2,4,60,0,0,0,0,0,'Alpine Linux 3.20','maintenance']
];
const demoNodes = normalizeDemoNodes();
function normalizeDemoNodes() {
  return DEMO_SEED.map((n,i) => ({uuid:n[0],name:n[1],region:n[2],group:n[3],cpu_name:n[4],cpu_cores:n[5],mem_total:n[6]*GIB,disk_total:n[7]*GIB,os:n[13],tags:n[14],weight:i,arch:'x86_64',virtualization:'KVM',swap_total:2*GIB,kernel_version:'6.8.0',public_remark:i===2?'核心应用服务器；计划升级内存。':i===5?'维护中，等待下一次心跳。':'Keep singing. Keep connected.',traffic_limit:2000*GIB,traffic_limit_type:'sum',currency:'USD',price:[12,6,18,5,10,4][i],billing_cycle:30,expired_at:new Date(Date.now()+(i===2?6:30+i*7)*86400000).toISOString()}));
}
function demoSnapshot(tick = 0) {
  const data = {}, online = [];
  DEMO_SEED.forEach((n,i) => {
    const wave = Math.sin(tick*.37+i*1.4);
    if(i!==5) online.push(n[0]);
    data[n[0]]={cpu:{usage:Math.max(0,n[8]+wave*2.1)},ram:{total:n[6]*GIB,used:n[6]*GIB*n[9]/100},disk:{total:n[7]*GIB,used:n[7]*GIB*n[10]/100},swap:{total:2*GIB,used:.15*GIB},network:{down:Math.max(0,(n[11]+wave*1.3)*1024**2),up:Math.max(0,(n[12]+wave*.5)*1024**2),totalDown:(180+i*84)*GIB,totalUp:(92+i*23)*GIB},uptime:(32+i*13)*86400+tick*2,load:{load1:n[8]/100*n[5],load5:.24,load15:.18},connections:{tcp:42+i*16,udp:6+i},process:112+i*21,updated_at:new Date(Date.now()-(i===5?3600000:0)).toISOString(),message:''};
  });
  return {status:'success',data:{online,data}};
}
const demoTasks = [{id:3,name:'中国 · 电信',type:'tcp',clients:DEMO_SEED.map(n=>n[0]),interval:60},{id:4,name:'中国 · 联通',type:'icmp',clients:DEMO_SEED.map(n=>n[0]),interval:60},{id:5,name:'中国 · 移动',type:'icmp',clients:DEMO_SEED.map(n=>n[0]),interval:60},{id:1,name:'Cloudflare',type:'icmp',clients:DEMO_SEED.map(n=>n[0]),interval:60}];
function demoHistory(uuid, hours = 1) {
  const i=Math.max(0,DEMO_SEED.findIndex(n=>n[0]===uuid)), seed=DEMO_SEED[i];
  return Array.from({length:120},(_,j)=>{
    const wave=Math.sin(j*.3+i)*6+Math.cos(j*.91)*3;
    return {time:new Date(Date.now()-(119-j)*hours*3600000/119).toISOString(),cpu:i===5?null:Math.max(1,seed[8]+wave),ram:(seed[9]+wave*.25)/100*seed[6]*GIB,ram_total:i===0?0:seed[6]*GIB,disk:seed[10]/100*seed[7]*GIB,disk_total:i===0?0:seed[7]*GIB,net_in:Math.max(0,(seed[11]+wave*.7)*1024**2),net_out:Math.max(0,(seed[12]+wave*.2)*1024**2),load:Math.max(0,seed[8]/100*seed[5]+wave*.03),swap:.15*GIB,swap_total:2*GIB,process:112+i*21,connections:42+i*16};
  });
}
function demoPing(uuid, hours=1) {
  const i=Math.max(0,DEMO_SEED.findIndex(n=>n[0]===uuid));
  return {tasks:demoTasks,records:demoTasks.flatMap((task,t)=>Array.from({length:60},(_,j)=>({client:uuid,task_id:task.id,time:new Date(Date.now()-(59-j)*hours*3600000/59).toISOString(),value:i===5?-1:j===22&&i===2?-1:Math.round([28,12,9,163,128,0][i]+t*12+Math.sin(j*.5+t)*4+Math.cos(j*.81)*2)})))};
}

// api.js

class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
async function apiGet(path, options = {}) {
  const ownController = new AbortController();
  const timer = setTimeout(() => ownController.abort(), 12000);
  const onAbort = () => ownController.abort();
  options.signal?.addEventListener('abort', onAbort, {once:true});
  if (options.signal?.aborted) ownController.abort();
  try {
    const response = await fetch(path, {...options, signal:ownController.signal, credentials:'same-origin', headers:{'Accept':'application/json',...options.headers}});
    let payload;
    try { payload = await response.json(); } catch { throw new ApiError('接口未返回 JSON，请确认主题安装在 Komari 上。', response.status); }
    if (!response.ok || payload.status === 'error') throw new ApiError(payload.message || `请求失败 (${response.status})`, response.status);
    return payload.data ?? payload;
  } catch(e) {
    if(e.name==='AbortError' && !options.signal?.aborted) throw new ApiError('请求超时，请检查网络连接。');
    throw e;
  } finally {clearTimeout(timer); options.signal?.removeEventListener('abort',onAbort);}
}

/** Request-driven Komari WebSocket with freshness timeout and bounded retry. */
class KomariTransport {
  constructor({onSnapshot, onConnection, Socket = globalThis.WebSocket, origin = globalThis.location?.origin, now = Date.now, random = Math.random, interval = 2000}) {
    this.onSnapshot=onSnapshot; this.onConnection=onConnection; this.Socket=Socket;
    this.origin=origin; this.now=now; this.random=random; this.interval=interval;
    this.stopped=true; this.paused=false; this.attempt=0; this.lastFrame=0;
  }
  start() { this.stop(); this.stopped=false; this.connect(); }
  connect() {
    if(this.stopped) return;
    this.onConnection(this.attempt ? 'reconnecting' : 'connecting');
    this.lastFrame=0; this.openAt=this.now();
    let ws;
    try {ws=new this.Socket(`${this.origin.replace(/^http/,'ws')}/api/clients`);} catch {this.scheduleRetry();return;}
    this.ws=ws;
    ws.onopen=()=>{
      if(this.ws!==ws || this.stopped) return;
      this.request();
      this.poll=setInterval(()=>{if(!this.paused) this.request();},this.interval);
    };
    ws.onmessage=e=>{
      if(this.ws!==ws || this.stopped) return;
      try {const s=normalizeSnapshot(JSON.parse(e.data));this.lastFrame=this.now();this.attempt=0;this.onConnection(this.paused?'paused':'live');this.onSnapshot(s);} catch {this.onConnection('error');ws.close();}
    };
    ws.onclose=()=>{
      if(this.ws!==ws || this.stopped) return;
      clearInterval(this.poll);clearInterval(this.watchdog);this.scheduleRetry();
    };
    ws.onerror=()=>{if(this.ws===ws&&!this.stopped) this.onConnection('reconnecting');};
    this.watchdog=setInterval(()=>{
      if(!this.paused && this.now()-(this.lastFrame||this.openAt)>15000) {this.onConnection('stale');ws.close();}
    },3000);
  }
  request() {if(this.ws?.readyState===1) this.ws.send('get');}
  scheduleRetry() {
    if(this.stopped) return;
    this.onConnection('reconnecting');
    const delay=Math.min(30000,1000*2**Math.min(this.attempt++,5))*(.85+this.random()*.3);
    this.retry=setTimeout(()=>this.connect(),delay);
  }
  setPaused(value) {this.paused=value;if(value)this.onConnection('paused');else{this.lastFrame=this.now();this.onConnection('connecting');this.request();}}
  stop() {
    this.stopped=true;clearTimeout(this.retry);clearInterval(this.poll);clearInterval(this.watchdog);
    const old=this.ws;this.ws=null;if(old)old.close();
  }
}

async function getNodes() { return normalizeNodes(await apiGet('/api/nodes')); }
async function getHistory(uuid, hours, signal) {
  const result=await apiGet(`/api/records/load?uuid=${encodeURIComponent(uuid)}&load_type=all&hours=${Number(hours)}`,{signal});
  if(result.records === null) return [];
  if(!Array.isArray(result.records)) throw new ApiError('历史记录格式不受支持');
  return result.records;
}
async function getPing(uuid,hours,signal) {
  const result=await apiGet(`/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=${Number(hours)}`,{signal});
  if(result.records===null)result.records=[];
  if(!Array.isArray(result.records)) throw new ApiError('Ping 记录格式不受支持');
  result.records=result.records.filter(r=>r&&typeof r==='object'&&(!r.client||r.client===uuid));
  return {...result,tasks:Array.isArray(result.tasks)?result.tasks:[]};
}

// charts.js

/** SVG with gaps for missing samples. The tooltip reports the actual timestamp. */
function chart(series, {label='趋势', unit='%', max=null, color='var(--accent)', height=170, mini=false, rhythm=false}={}) {
  let points=series.filter(p=>Number.isFinite(p.time));
  const originalCount=points.length, values=points.map(p=>numeric(p.value)).filter(v=>v!==null&&v>=0);
  if(!points.length || !values.length) return `<div class="chart-empty">暂无${escapeHTML(label)}记录</div>`;
  const width=720, left=mini?0:55, right=mini?0:16, top=mini?4:14, bottom=mini?4:30;
  const valueMaximum=values.reduce((a,b)=>Math.max(a,b),0), valueMinimum=values.reduce((a,b)=>Math.min(a,b),Infinity);
  const upper=max??Math.max(1,valueMaximum)*1.18;
  // Bound rendering cost on 72-hour records. Keep bucket peaks and missing samples.
  if(points.length>720){const result=[],step=Math.ceil(points.length/720);for(let i=0;i<points.length;i+=step){const bucket=points.slice(i,i+step),gap=bucket.find(p=>numeric(p.value)===null||p.value<0);result.push(gap||bucket.reduce((a,b)=>b.value>a.value?b:a));}points=[points[0],...result,points.at(-1)];}
  const t0=points[0].time, t1=points.at(-1).time;
  const x=p=>left+(p.time-t0)/Math.max(1,t1-t0)*(width-left-right);
  const y=p=>top+(1-Math.min(upper,Math.max(0,p.value))/upper)*(height-top-bottom);
  let line='', fill='', markers='', segment=[];
  const flush=()=>{if(segment.length){const head=segment[0],tail=segment.at(-1);const path=segment.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ');line+=path+' ';fill+=`${path} L${x(tail).toFixed(1)},${height-bottom} L${x(head).toFixed(1)},${height-bottom} Z `;if(segment.length===1)markers+=`<circle cx="${x(head).toFixed(1)}" cy="${y(head).toFixed(1)}" r="1.8" fill="${color}" vector-effect="non-scaling-stroke"/>`;segment=[];}};
  points.forEach(p=>{if(numeric(p.value)===null||p.value<0) flush();else segment.push(p);});flush();
  const fmt=n=>unit==='B/s'?bytes(n,true):`${n.toFixed(n<10?1:0)}${unit}`;
  const grid=mini?'':Array.from({length:4},(_,i)=>{const v=upper*i/3,yy=top+(1-i/3)*(height-top-bottom);return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" class="chart-grid"/><text x="${left-10}" y="${yy+4}" text-anchor="end">${escapeHTML(fmt(v))}</text>`;}).join('');
  const score=rhythm?window.MikuMusic.bins(series,72).map(point=>{const p={time:point.time,value:point.value},xx=x(p),columnWidth=Math.min(6,(width-left-right)/72*.56);return (point.value===null?'':`<rect x="${(xx-columnWidth/2).toFixed(1)}" y="${y(p).toFixed(1)}" width="${columnWidth}" height="${Math.max(1,height-bottom-y(p)).toFixed(1)}" fill="${color}" opacity=".18" rx="1"/>`)+(point.failed?`<path d="M${xx-3},${top+3}l6,6m-6,0l6,-6" class="rhythm-break"/>`:'');}).join(''):'';
  const times=mini?'':[0,.25,.5,.75,1].map(f=>`<text x="${left+f*(width-left-right)}" y="${height-7}" text-anchor="${f===0?'start':f===1?'end':'middle'}">${new Date(t0+(t1-t0)*f).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</text>`).join('');
  return `<div class="chart ${mini?'mini-chart':''}" ${mini?'':`data-chart='${escapeHTML(JSON.stringify({points,unit,label}))}' tabindex="0"`}><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHTML(label)}，${originalCount}个采样，最小${escapeHTML(fmt(valueMinimum))}，最大${escapeHTML(fmt(valueMaximum))}${originalCount>720?'，曲线按区间峰值降采样':''}">${grid}${score}<path d="${fill}" fill="${color}" opacity=".08"/><path d="${line}" stroke="${color}" stroke-width="${mini?1.5:2}" vector-effect="non-scaling-stroke" fill="none"/>${markers}${times}</svg>${mini?'':'<div class="chart-tooltip" hidden></div>'}</div>`;
}

function setupChartTooltips(root) {
  root.addEventListener('pointermove',e=>{
    const el=e.target.closest('[data-chart]');if(!el)return;
    let data;try{data=JSON.parse(el.dataset.chart);}catch{return;}
    const bounds=el.getBoundingClientRect(), fraction=Math.min(1,Math.max(0,((e.clientX-bounds.left)/bounds.width*720-55)/649));
    const target=data.points[0].time+fraction*(data.points.at(-1).time-data.points[0].time);
    const point=data.points.reduce((a,b)=>Math.abs(b.time-target)<Math.abs(a.time-target)?b:a);
    const tip=el.querySelector('.chart-tooltip');tip.hidden=false;
    const value=numeric(point.value)===null?'无数据':point.value<0?'丢包':data.unit==='B/s'?bytes(point.value,true):`${point.value.toFixed(1)}${data.unit}`;
    tip.textContent=`${new Date(point.time).toLocaleTimeString()} · ${value}`;
    tip.style.left=`${Math.min(bounds.width-145,Math.max(0,e.clientX-bounds.left-68))}px`;
  });
  root.addEventListener('pointerout',e=>{const el=e.target.closest('[data-chart]');if(el&&!el.contains(e.relatedTarget))el.querySelector('.chart-tooltip').hidden=true;});
}

// app.js





const WALLPAPERS=[{id:'daydream',name:'晴空初音',subtitle:'DAYDREAM / 01'},{id:'wonderland',name:'甜梦游园',subtitle:'WONDERLAND / 02'},{id:'starlight',name:'星光舞台',subtitle:'STARLIGHT / 03'}];
const MASCOTS=[{id:'classic',file:'miku.webp',name:'经典 · 初音',caption:'今日也要保持连接呀 ♪'},{id:'leek',file:'miku-leek.webp',name:'葱葱 · 日常',caption:'给每一份心跳加点元气 ♪'},{id:'orbit',file:'miku-orbit.webp',name:'星航 · 宇宙',caption:'从世界各地，连接你的未来 ♪'},{id:'song',file:'miku-song.webp',name:'应援 · 歌姬',caption:'每一台服务器，都有自己的旋律 ♪'}];
const CHINA_TARGETS=window.MikuDestinations.targets;
const NODE_SIZES=[{id:'mini',name:'极简',description:'更小卡片，精简说明'},{id:'compact',name:'紧凑',description:'减少留白，完整数据'},{id:'standard',name:'标准',description:'原版大小，完整信息'},{id:'large',name:'放大',description:'大字大图，轻松阅读'}];
const DEFAULT_PREFS={wallpaper:'daydream',backgroundSource:'builtin',backgroundURL:'',dim:60,blur:3,mascot:true,mascotId:'classic',motion:true,rotate:false,focus:false,compact:true,nodeSize:'compact',view:'grid',glass:true,panelOpacity:64,glassBlur:24,borderStrength:32,showPing:true,showGlobe:true,globeRotate:true,rhythm:true,globeQuality:'auto',globeGlow:70,chinaTarget:'china',destinationVersion:2,destinationTouched:false,customTarget:{name:'自定义区域',lat:35.8617,lng:104.1954}};
const asset=name=>window.MIKU39_ASSETS?.[name] || `${window.MIKU39_ASSET_BASE || './assets/'}${name}`;
const savedPreferences=safeRead('miku39.preferences.v1',{});
const storedPreferences=savedPreferences&&typeof savedPreferences==='object'&&!Array.isArray(savedPreferences)?savedPreferences:{};
const prefs={...DEFAULT_PREFS,...(storedPreferences&&typeof storedPreferences==='object'?storedPreferences:{})};
let nodeSizeChosen=NODE_SIZES.some(s=>s.id===storedPreferences.nodeSize)||typeof storedPreferences.compact==='boolean';
// Preserve the old compact toggle; new visitors start with the recommended size.
if(!NODE_SIZES.some(s=>s.id===storedPreferences.nodeSize))prefs.nodeSize=storedPreferences.compact===false?'standard':DEFAULT_PREFS.nodeSize;
prefs.compact=['mini','compact'].includes(prefs.nodeSize);
if(!WALLPAPERS.some(w=>w.id===prefs.wallpaper))prefs.wallpaper='daydream';
prefs.backgroundURL=window.MikuBackgrounds.normalizeURL(prefs.backgroundURL)||'';
if(!['builtin','local','url'].includes(prefs.backgroundSource)||prefs.backgroundSource==='url'&&!prefs.backgroundURL)prefs.backgroundSource='builtin';
const background={local:null,remote:null,busy:false,error:'',sequence:0,controller:null};
prefs.dim=clamp(numeric(prefs.dim)??60,20,95);prefs.blur=clamp(numeric(prefs.blur)??3,0,16);
prefs.panelOpacity=clamp(numeric(prefs.panelOpacity)??64,10,100);prefs.glassBlur=clamp(numeric(prefs.glassBlur)??24,0,40);prefs.borderStrength=clamp(numeric(prefs.borderStrength)??32,0,100);
prefs.globeGlow=clamp(numeric(prefs.globeGlow)??70,0,100);if(!['auto','high','eco'].includes(prefs.globeQuality))prefs.globeQuality='auto';
if(!MASCOTS.some(m=>m.id===prefs.mascotId))prefs.mascotId='classic';
// v1.1 used Shanghai as an implicit default. Upgrades start with China nationwide.
if(storedPreferences.destinationVersion!==2){prefs.chinaTarget='china';prefs.destinationTouched=false;}
prefs.destinationVersion=2;
prefs.destinationTouched=prefs.destinationTouched===true;
const savedCustomTarget=window.MikuDestinations.customTarget(prefs.customTarget);
if(prefs.chinaTarget==='custom'&&!savedCustomTarget)prefs.chinaTarget='china';
prefs.customTarget=savedCustomTarget||{...DEFAULT_PREFS.customTarget};
if(!CHINA_TARGETS[prefs.chinaTarget]&&prefs.chinaTarget!=='custom')prefs.chinaTarget='china';
for(const key of ['mascot','motion','rotate','focus','compact','glass','showPing','showGlobe','globeRotate','rhythm'])if(typeof prefs[key]!=='boolean')prefs[key]=DEFAULT_PREFS[key];
const savedFavorites=safeRead('miku39.favorites.v1',[]);
const GLOBE_LABEL_KEY='miku39.globe-labels.v1';
const globeLabels=normalizeGlobeLabels(safeRead(GLOBE_LABEL_KEY,{}));
const isDemo=window.MIKU39_DEMO===true || new URLSearchParams(location.search).get('demo')==='1';
const state={nodes:[],snapshot:null,connection:isDemo?'demo':'connecting',loading:true,error:null,view:prefs.view==='table'?'table':'grid',tab:'nodes',group:'all',search:'',filter:'all',sort:'weight',favorites:new Set(Array.isArray(savedFavorites)?savedFavorites:[]),settings:{},me:{logged_in:false},lastUpdate:0,tick:0,paused:false,samples:new Map(),globeLabelUUID:null,detail:{uuid:null,tab:'overview',hours:1,records:[],ping:null,loading:false,error:null},network:{uuid:'',hours:1,task:'all',data:null,loading:false,error:null}};
let transport, demoTimer, rotationTimer, toastTimer, renderQueued=false, detailController, networkController, initGeneration=0, globe;
const inlinePings=new Map(), pingJobs=new Map(), pingQueue=[];let pingActive=0, publicPingTasks=null, pingTaskPromise=null;
const $=id=>document.getElementById(id);
const html=escapeHTML;
const patch=(target,markup)=>window.MikuDOM.patchMarkup(typeof target==='string'?$(target):target,markup);
const text=(target,value)=>{const el=typeof target==='string'?$(target):target,next=String(value);if(el&&el.textContent!==next)el.textContent=next;};
const attr=(el,name,value)=>{if(el&&el.getAttribute(name)!==String(value))el.setAttribute(name,String(value));};
function getChinaTarget(){return prefs.chinaTarget==='custom'?window.MikuDestinations.customTarget(prefs.customTarget)||CHINA_TARGETS.china:CHINA_TARGETS[prefs.chinaTarget]||CHINA_TARGETS.china;}
function destinationOptions(){return '<option value="china">中国（全国）</option>'+window.MikuDestinations.groups.map(([name,regions])=>`<optgroup label="${name}">${regions.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</optgroup>`).join('')+'<option value="custom">自定义区域</option>';}
function syncDestinationEditor(reset=false){
 const editor=$('custom-destination');if(!editor)return;
 editor.hidden=prefs.chinaTarget!=='custom';
 if(reset)for(const key of ['name','lat','lng'])$('destination-'+key).value=prefs.customTarget[key];
 if(reset&&$('destination-error'))$('destination-error').hidden=true;
}
function saveCustomDestination(){
 const target=window.MikuDestinations.customTarget({name:$('destination-name').value,lat:$('destination-lat').value,lng:$('destination-lng').value});
 if(!target){text('destination-error','请填写区域名称、纬度（−90～90）和经度（−180～180）。');$('destination-error').hidden=false;return;}
 prefs.customTarget=target;prefs.chinaTarget='custom';prefs.destinationTouched=true;
 persistPreferences();syncDestinationEditor(true);syncGlobe();globe?.focusTarget();toast('汇聚区域已保存');
}
const connectionNames={demo:'演示数据',live:'实时连接',connecting:'正在连接',reconnecting:'正在重连',stale:'数据过期',paused:'已暂停',error:'连接异常'};
const statusNames={online:'在线',offline:'离线',unknown:'待更新'};
const needsLogin=()=>!!state.error&&([401,403].includes(state.error.status)||state.settings.private_site&&!state.me.logged_in||/private site|login first/i.test(state.error.message));
const appearanceQuery=matchMedia('(prefers-color-scheme: light)');
let appearance='dark';try{const saved=localStorage.getItem('appearance');if(['dark','light','system'].includes(saved))appearance=saved;}catch{}

function persistPreferences(){const saved=safeWrite('miku39.preferences.v1',prefs);if(!saved)toast('浏览器无法保存偏好，当前设置仍已生效。');return saved;}
function currentWallpaper(){return prefs.backgroundSource==='local'&&background.local?background.local.url:prefs.backgroundSource==='url'&&background.remote===prefs.backgroundURL?background.remote:asset(prefs.wallpaper+'.webp');}
function cancelBackgroundChange(){background.sequence++;background.controller?.abort();background.controller=null;background.busy=false;background.error='';}
function useBuiltinWallpaper(id){
 if(!WALLPAPERS.some(w=>w.id===id))return;
 cancelBackgroundChange();prefs.wallpaper=id;prefs.backgroundSource='builtin';applyPreferences();renderWallpapers();if(persistPreferences())toast('背景已切换');
}
async function selectCustomWallpaper(source,value){
 cancelBackgroundChange();const sequence=background.sequence,controller=new AbortController();background.controller=controller;background.busy=true;renderWallpapers();
 try{
  const result=source==='local'?await window.MikuBackgrounds.storeLocal(value,controller.signal):await window.MikuBackgrounds.loadURL(value,controller.signal);
  if(sequence!==background.sequence){if(source==='local')URL.revokeObjectURL(result.url);return false;}
  if(source==='local'){if(background.local)URL.revokeObjectURL(background.local.url);background.local=result;}
  else{background.remote=result;prefs.backgroundURL=result;}
  prefs.backgroundSource=source;background.busy=false;background.controller=null;applyPreferences();renderWallpapers();if(persistPreferences())toast('自定义背景已保存');return true;
 }catch(error){
  if(sequence!==background.sequence||error.name==='AbortError')return false;
  background.busy=false;background.controller=null;background.error=error.message||'图片无法加载，请重试。';renderWallpapers();return false;
 }
}
function applyWallpaperURL(){return selectCustomWallpaper('url',$('wallpaper-url').value);}
function useSavedWallpaper(){if(!background.local)return;cancelBackgroundChange();prefs.backgroundSource='local';applyPreferences();renderWallpapers();if(persistPreferences())toast('已使用保存的本地图片');}
async function restoreCustomBackground(){
 cancelBackgroundChange();const sequence=background.sequence,controller=new AbortController();background.controller=controller;
 const [local,remote]=await Promise.allSettled([window.MikuBackgrounds.readLocal(controller.signal),prefs.backgroundSource==='url'?window.MikuBackgrounds.loadURL(prefs.backgroundURL,controller.signal):Promise.resolve(null)]);
 if(sequence!==background.sequence){if(local.status==='fulfilled'&&local.value)URL.revokeObjectURL(local.value.url);return;}
 background.controller=null;
 if(local.status==='fulfilled'&&local.value){if(background.local)URL.revokeObjectURL(background.local.url);background.local=local.value;}
 if(remote.status==='fulfilled'&&remote.value)background.remote=remote.value;
 if(prefs.backgroundSource==='local'&&!background.local)background.error='已保存的本地图片无法读取，暂用内置背景；请重新选择图片。';
 if(prefs.backgroundSource==='url'&&remote.status==='rejected')background.error='自定义链接暂时无法加载，暂用内置背景；请检查链接后重新应用。';
 applyPreferences();renderWallpapers();
}
function applyPreferences(){
  const wallpaper=currentWallpaper(),custom=wallpaper!==asset(prefs.wallpaper+'.webp');
  document.documentElement.style.setProperty('--wallpaper',`url(${JSON.stringify(wallpaper)})`);
  document.documentElement.style.setProperty('--dim',String(prefs.dim/100));
  document.documentElement.style.setProperty('--blur',prefs.blur+'px');
  document.documentElement.style.setProperty('--panel-opacity',String(prefs.panelOpacity/100));
  document.documentElement.style.setProperty('--glass-blur',(prefs.glass?prefs.glassBlur:0)+'px');
  document.documentElement.style.setProperty('--glass-border-alpha',String(prefs.borderStrength/100));
  document.documentElement.dataset.glass=prefs.glass?'on':'off';
  document.documentElement.style.setProperty('--hero-position',custom?'50%':({daydream:'17%',wonderland:'23%',starlight:'30%'})[prefs.wallpaper]);
  document.documentElement.dataset.motion=prefs.motion?'on':'off';
  document.documentElement.dataset.rhythm=prefs.rhythm?'on':'off';
  document.documentElement.style.setProperty('--rhythm-glow',String(.4+prefs.globeGlow/100*.6));
  document.documentElement.dataset.mascot=prefs.mascot?'on':'off';
  document.documentElement.dataset.focus=String(prefs.focus);
  document.documentElement.dataset.nodeSize=prefs.nodeSize;
  document.documentElement.dataset.appearance=appearance==='system'?(appearanceQuery.matches?'light':'dark'):appearance;
  if($('hero-art-label'))$('hero-art-label').textContent=custom?(prefs.backgroundSource==='local'?'自定义背景 · 本地':'自定义背景 · 链接'):WALLPAPERS.find(w=>w.id===prefs.wallpaper).subtitle;
  if($('mascot-image')){const m=MASCOTS.find(m=>m.id===prefs.mascotId);if($('mascot-image').getAttribute('src')!==asset(m.file))$('mascot-image').src=asset(m.file);$('mascot-image').alt=m.name+'，坐在小服务器上的初音吉祥物';$('mascot-caption').textContent=m.caption;$('mascot-button').setAttribute('aria-label',m.name+'，打开吉祥物选择');}
  if($('globe-panel')){$('globe-panel').hidden=!prefs.showGlobe;if(prefs.showGlobe)syncGlobe();else globe?.stop();}
  clearInterval(rotationTimer);
  if(prefs.rotate&&prefs.backgroundSource==='builtin')rotationTimer=setInterval(()=>{if(document.hidden)return;const i=WALLPAPERS.findIndex(w=>w.id===prefs.wallpaper);prefs.wallpaper=WALLPAPERS[(i+1)%3].id;applyPreferences();persistPreferences();if($('wallpaper-dialog')?.open)renderWallpapers();},60000);
}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2600);}
function showDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();globe?.setOptions({paused:true});}
function formatDate(date){const time=parseTime(date);return time!==null?new Date(time).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
function briefAge(date){if(!date)return'未上报';const m=Math.max(0,Math.round((Date.now()-Date.parse(date))/60000));return m<1?'刚刚':m<60?`${m}分钟前`:m<1440?`${Math.floor(m/60)}小时前`:`${Math.floor(m/1440)}天前`;}
function getReport(uuid){return state.snapshot?.reports[uuid] || null;}
function getStatus(uuid){return nodeState(uuid,state.snapshot,state.connection);}
function statusBadge(uuid){const status=getStatus(uuid);return `<span class="node-status ${status}"><i class="dot"></i>${status==='unknown'&&state.snapshot?'数据过期':statusNames[status]}</span>`;}
function trafficMarkup(n,report,status='online'){
  const used=trafficUsage(n,report),limit=capacity(n.traffic_limit),ratio=percent(used,limit),mode=({sum:'上传 + 下载',max:'上传、下载取最大值',min:'上传、下载取最小值',up:'仅上传',down:'仅下载'})[n.traffic_limit_type||'max']||'上传、下载取最大值';
  return `<section class="server-traffic" data-render-key="server-traffic" aria-label="服务器流量"><div class="server-traffic-head"><span>${icon('network')}流量 <small>${status==='online'?'累计用量':'历史累计'}</small></span><strong>${bytes(used)}${limit?' / '+bytes(limit):''}</strong></div>${limit?`<div class="meter ${ratio>=90?'danger':ratio>=75?'warn':''}" role="meter" aria-label="流量配额使用率" aria-valuemin="0" aria-valuemax="100" ${ratio===null?'':`aria-valuenow="${ratio.toFixed(1)}"`}><span style="--value:${ratio??0}%"></span></div>`:''}<div class="server-traffic-counts"><span>↑ ${bytes(report?.network?.totalUp)}</span><span>↓ ${bytes(report?.network?.totalDown)}</span></div><div class="server-traffic-note">${limit?'配额口径：'+html(mode):'未设流量配额 · 口径：'+html(mode)}${limit&&used!==null&&used>limit?` · <span class="pink">已超出 ${bytes(used-limit)}</span>`:''}</div></section>`;
}
function billingMarkup(n,compact=false){
  const time=expiryTime(n.expired_at),urgent=time!==null&&time-Date.now()<7*86400000;
  if(compact)return `<dl class="server-billing server-billing-compact" data-render-key="server-billing"><div class="billing-price"><dt aria-label="服务器价格">价格</dt><dd>${html(priceText(n))}</dd></div><div class="billing-expiry ${urgent?'expiry-urgent':''}"><dt aria-label="到期时间">到期</dt><dd><span class="billing-date">${html(expiryDate(n.expired_at))}</span>${time===null?'':`<small>${html(expiryText(n.expired_at))}</small>`}</dd></div></dl>`;
  return `<dl class="server-billing" data-render-key="server-billing"><div><dt>服务器价格</dt><dd>${html(priceText(n))}</dd></div><div class="${urgent?'expiry-urgent':''}"><dt>到期时间</dt><dd>${html(expiryDate(n.expired_at))}</dd><small>${html(time===null?'后台未设置':expiryText(n.expired_at))}</small></div></dl>`;
}
function favoriteButton(uuid){const saved=state.favorites.has(uuid);return `<button type="button" class="favorite ${saved?'saved':''}" data-favorite="${html(uuid)}" aria-label="${saved?'取消收藏':'收藏'}服务器" aria-pressed="${saved}">${icon('star')}</button>`;}
function emptyState(title,description,action=''){return `<div class="empty-state">${icon('music')}<h2>${html(title)}</h2><p>${html(description)}</p>${action}</div>`;}
function metricRow(label,value,totalValue,kind,iconName){const used=typeof value==='number'?value:null;return `<div><div class="metric-header"><span>${icon(iconName)}${html(label)}</span><strong>${pct(used)}${totalValue?`<small>${html(totalValue)}</small>`:''}</strong></div><div class="meter ${kind} ${used>=90?'danger':used>=75?'warn':''}" role="meter" aria-label="${html(label)}" aria-valuemin="0" aria-valuemax="100" ${used===null?'':`aria-valuenow="${used.toFixed(1)}"`}><span style="--value:${used??0}%"></span></div></div>`;}

function renderShell(){
  $('app').innerHTML=`
  <header class="km-navbar"><div class="wrap nav-inner"><a class="brand" href="#" aria-label="Miku Monitor 首页"><span class="brand-mark">39</span><div><div class="brand-title">MIKU <i>MONITOR</i></div><div class="brand-sub">HATSUNE MIKU × KOMARI</div></div></a><div class="nav-actions"><span id="connection" class="connection-pill"><i class="dot live-dot"></i><span>${connectionNames[state.connection]}</span></span><button class="icon-button" data-dialog="wallpaper-dialog" aria-label="切换背景" title="切换背景">${icon('image')}</button><button class="icon-button" id="nav-appearance" data-action="appearance" aria-label="切换明暗外观" title="切换明暗外观">${icon('sun')}</button><button class="icon-button" data-dialog="settings-dialog" aria-label="Miku 主题设置" title="Miku 主题设置">${icon('settings')}</button><a class="admin-link" id="admin-link" href="/admin" title="Komari 管理后台">${icon('lock')}<span>管理</span></a></div></div></header>
  <main class="wrap km-main km-page-instance" id="main" tabindex="-1">
    <section class="hero" aria-labelledby="site-title"><div class="hero-copy"><div class="eyebrow">39 NETWORK · LIVE VIEW</div><h1 id="site-title">每一份连接，都有<em>回响。</em></h1><p class="hero-desc" id="site-description">让未来的声音，陪伴你的每一台服务器。</p><div class="hero-bottom"><div class="hero-equalizer" aria-hidden="true">${[6,13,8,17,10,5,14,9].map((h,i)=>`<span style="--height:${h}px;--delay:${i*.15}s"></span>`).join('')}</div><strong id="hero-state">正在读取服务器</strong><span class="divider"></span><span id="hero-time"></span><span class="hero-version">MIKU THEME / 1.4.2</span></div></div><span class="hero-watermark" aria-hidden="true">39</span><button class="hero-art-label" id="hero-art-label" data-dialog="wallpaper-dialog">DAYDREAM / 01</button><div class="hero-companion"><button class="mascot" id="mascot-button" data-dialog="settings-dialog" aria-label="打开吉祥物选择"><span class="mascot-caption" id="mascot-caption">今日也要保持连接呀 ♪</span><img id="mascot-image" src="${asset('miku.webp')}" alt="经典初音吉祥物" width="600" height="627"></button><button class="companion-switch" data-action="next-mascot" aria-label="切换下一只吉祥物">${icon('refresh')}换个伙伴</button></div></section>
    <section class="summary" id="summary" aria-label="集群概况"></section>
    <section class="panel globe-panel" id="globe-panel" aria-labelledby="globe-title"><div class="globe-visual"><div class="globe-overline">MIKU / WORLD STAGE <span class="globe-live-tag" id="globe-state">等待服务器</span></div><canvas id="traffic-globe" tabindex="0" role="img" aria-label="可旋转的三维地球；在线 VPS 到中国的流向示意。拖动或使用方向键旋转，Home 复位。"></canvas><div class="globe-stage-corner" aria-hidden="true"><span>01 / GLOBAL MIX</span><span>WORLD → CHINA</span></div><div class="globe-tools"><span>拖动旋转 · 点击位置</span><div><button class="icon-button" data-action="globe-zoom-out" aria-label="缩小地球">−</button><button class="icon-button" data-action="globe-zoom-in" aria-label="放大地球">+</button><button class="icon-button" data-action="globe-focus" aria-label="聚焦所选汇聚区域" title="聚焦汇聚区域">${icon('globe')}</button><button class="icon-button" data-action="globe-reset" aria-label="重置地球视角">${icon('refresh')}</button><button class="icon-button" id="globe-rotate" data-action="globe-rotate" aria-label="暂停地球自转" aria-pressed="true">${icon('pause')}</button></div></div></div><div class="globe-copy"><div class="eyebrow">WORLDWIDE → CHINA</div><h2 id="globe-title">世界的节拍，在这里汇聚。</h2><p class="globe-subtitle">让每条连接，成为舞台上的一束光。</p><div class="globe-track-legend globe-position-legend"><span><i class="server-status-dot online"></i>在线服务器</span><span><i class="server-status-dot offline"></i>离线服务器</span><span><i class="server-status-dot unknown"></i>待确认</span><span><i class="dot pink"></i>汇聚点</span></div><div class="globe-destination"><label for="china-target">汇聚位置</label><select id="china-target" aria-label="中国汇聚位置">${destinationOptions()}</select><span>${flag('CN')}</span></div><form id="custom-destination" class="custom-destination" hidden><label class="destination-name">区域名称<input id="destination-name" maxlength="32" required placeholder="例如：华东汇聚点"></label><label>纬度<input id="destination-lat" type="number" min="-90" max="90" step="any" required inputmode="decimal"></label><label>经度<input id="destination-lng" type="number" min="-180" max="180" step="any" required inputmode="decimal"></label><button class="secondary-button" type="submit">应用区域</button><p id="destination-error" class="destination-error" role="alert" hidden></p><small>自定义名称与坐标仅用于流向示意。</small></form><div class="destination-caption" id="destination-caption">默认汇聚：中国 · 全国示意</div><div class="globe-metrics"><div><small>可定位服务器</small><strong id="globe-node-count">—</strong></div><div><small>服务器总上传</small><strong id="globe-upload">—</strong></div></div><p class="globe-position-help">点击名称定位 · 点铅笔改名 · 同位置数字表示数量</p><div id="globe-routes" class="globe-route-list" aria-label="服务器位置列表"></div><p class="globe-note">方向仅为视觉示意，速率取服务器总上传；不是实际到中国的流量统计。无坐标时使用城市或地区代表点；底图使用 Natural Earth 陆地数据。</p></div></section>
    <div class="tabs-toolbar"><div class="main-tabs" role="tablist" aria-label="监控视图"><button class="main-tab active" role="tab" id="tab-nodes" aria-controls="nodes-panel" aria-selected="true" data-tab="nodes">${icon('server')}服务器概览<span class="tab-count" id="node-count">0</span></button><button class="main-tab" role="tab" id="tab-network" aria-controls="network-panel" aria-selected="false" data-tab="network" tabindex="-1">${icon('pulse')}网络监测</button><button class="main-tab" role="tab" id="tab-favorites" aria-controls="nodes-panel" aria-selected="false" data-tab="favorites" tabindex="-1">${icon('star')}我的收藏<span class="tab-count" id="favorite-count">0</span></button></div><div class="refresh-controls"><span class="last-update" id="last-update">等待更新</span><button class="icon-button" data-action="pause" id="pause-button" aria-label="暂停实时更新" title="暂停实时更新">${icon('pause')}</button><button class="icon-button" data-action="refresh" aria-label="立即刷新" title="立即刷新">${icon('refresh')}</button></div></div>
    <div id="error-banner" hidden></div>
    <section id="nodes-panel" role="tabpanel" aria-labelledby="tab-nodes"><div class="filters"><div class="groups" id="groups"></div><div class="filter-inputs"><label class="search-box">${icon('search')}<input id="search-input" type="search" placeholder="搜索服务器、地区、标签" aria-label="搜索服务器"><kbd>/</kbd></label><select id="status-select" aria-label="筛选服务器状态"><option value="all">全部状态</option><option value="online">在线</option><option value="offline">离线</option><option value="unknown">待更新</option></select><select id="sort-select" aria-label="服务器排序"><option value="weight">默认排序</option><option value="name">服务器名称</option><option value="cpu">CPU 降序</option><option value="ram">内存降序</option><option value="traffic">流量降序</option><option value="expiry">到期时间</option></select><div class="view-toggle" aria-label="显示方式"><button data-view="grid" aria-label="卡片视图" aria-pressed="true">${icon('grid')}</button><button data-view="table" aria-label="表格视图" aria-pressed="false">${icon('list')}</button></div></div></div><div id="nodes-container" class="node-grid km-instance-server-list"></div><div class="fleet-foot"><span id="filter-count">正在读取服务器…</span><span>${icon('info')}速率按字节每秒显示</span></div></section>
    <section id="network-panel" class="panel network-panel" role="tabpanel" aria-labelledby="tab-network" hidden></section>
    <footer class="km-footer"><div class="footer-brand">${icon('music')}Made with <span class="pink">♡</span> & a little Miku magic.</div><div class="footer-right"><a href="https://github.com/komari-monitor/komari" target="_blank" rel="noopener noreferrer">Powered by Komari Monitor.</a><span>MIKU39 v1.4.5</span><a id="logout-link" href="/api/logout" hidden>退出登录</a><button data-dialog="settings-dialog">个性化</button></div></footer>
  </main>

  <dialog id="wallpaper-dialog" aria-labelledby="wallpaper-title"><div class="dialog-inner"><div class="dialog-header"><div><h2 id="wallpaper-title">${icon('image')}选择你的世界</h2><p>上传你的图片，或选择一种初音心情。</p></div><button class="icon-button" data-close="wallpaper-dialog" aria-label="关闭背景设置">${icon('close')}</button></div><div id="wallpaper-options"></div></div></dialog>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-inner"><div class="dialog-header"><div><h2 id="settings-title">${icon('settings')}Miku 个性化设置</h2><p>外观偏好只保存在当前浏览器。</p></div><button class="icon-button" data-close="settings-dialog" aria-label="关闭主题设置">${icon('close')}</button></div><div id="settings-options"></div></div></dialog>
  <dialog id="detail-dialog" aria-labelledby="detail-title"><div class="dialog-inner" id="detail-content"></div></dialog>
  <dialog id="globe-group-dialog" aria-labelledby="globe-group-title"><div class="dialog-inner" id="globe-group-content"></div></dialog>
  <dialog id="globe-label-dialog" aria-labelledby="globe-label-title"><div class="dialog-inner"><div class="dialog-header"><div><h2 id="globe-label-title">${icon('edit')}标记名称</h2><p id="globe-label-server"></p></div><button class="icon-button" data-close="globe-label-dialog" aria-label="取消编辑名称">${icon('close')}</button></div><form id="globe-label-form" class="globe-label-form" novalidate><label for="globe-label-name">自定义名称<input id="globe-label-name" type="text" maxlength="64" autocomplete="off" aria-describedby="globe-label-note globe-label-error"></label><p id="globe-label-note" class="dialog-note">最多 32 个字符，用于地球标记和位置列表。留空使用服务器原名，设置保存在当前浏览器。</p><p id="globe-label-error" class="destination-error" role="alert" hidden></p><div class="dialog-footer"><button type="button" class="text-button" data-action="restore-globe-label">恢复原名</button><div class="globe-label-actions"><button type="button" class="secondary-button" data-close="globe-label-dialog">取消</button><button type="submit" class="primary-button">保存名称</button></div></div></form></div></dialog>
  <dialog id="login-dialog" aria-labelledby="login-title"><div class="dialog-inner"><div class="dialog-header"><span></span><button class="icon-button" data-close="login-dialog" aria-label="关闭登录">${icon('close')}</button></div><div class="login-hero"><img src="${asset('miku.webp')}" alt="Miku" width="110" height="115"><h2 id="login-title">欢迎回来</h2><p>登录 Komari，继续与你的服务器连接。</p></div><form id="login-form" class="login-form"><label>用户名<input name="username" autocomplete="username" required maxlength="100"></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><label>两步验证码（如已启用）<input name="2fa_code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="未启用时留空"></label><div class="login-error" id="login-error" role="alert" hidden></div><button class="primary-button" type="submit" id="login-submit">登录并连接</button></form><a href="/api/oauth" class="secondary-button oauth-link" id="oauth-link" hidden>使用单点登录</a></div></dialog>`;
  for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>syncGlobe());}
  $('detail-dialog').addEventListener('close',()=>{detailController?.abort();state.detail.uuid=null;history.replaceState(null,'',location.pathname+location.search);});
  $('globe-label-dialog').addEventListener('close',()=>{state.globeLabelUUID=null;});
  document.addEventListener('click',handleClick);
  document.addEventListener('change',handleChange);
  document.addEventListener('input',handleInput);
  document.addEventListener('keydown',handleKeydown);
  document.addEventListener('submit',e=>{if(e.target.id==='wallpaper-url-form'){e.preventDefault();applyWallpaperURL();}});
  $('login-form').addEventListener('submit',login);
  $('custom-destination').addEventListener('submit',e=>{e.preventDefault();saveCustomDestination();});
  $('globe-label-form').addEventListener('submit',e=>{e.preventDefault();saveGlobeLabel();});
  syncDestinationEditor(true);
  setupChartTooltips(document);
  appearanceQuery.addEventListener('change',()=>{if(appearance==='system')applyPreferences();});
  renderWallpapers();renderSettings();applyPreferences();render();
}

function renderSummary(){
  const active=state.nodes.filter(n=>getStatus(n.uuid)==='online'), offline=state.nodes.filter(n=>getStatus(n.uuid)==='offline').length;
  const reports=active.map(n=>getReport(n.uuid)).filter(Boolean);
  const cpus=reports.map(r=>numeric(r.cpu?.usage)).filter(v=>v!==null);
  const memory=active.map(n=>({used:nonnegative(getReport(n.uuid)?.ram?.used),total:capacity(getReport(n.uuid)?.ram?.total,n.mem_total)})).filter(r=>r.used!==null&&r.total!==null);
  const memPct=memory.length?percent(memory.reduce((s,r)=>s+r.used,0),memory.reduce((s,r)=>s+r.total,0)):null;
  const download=reports.filter(r=>numeric(r.network?.down)!==null), upload=reports.filter(r=>numeric(r.network?.up)!==null);
  const cards=[
    {label:'服务器在线',value:state.loading?'—':active.length,sub:`/ ${state.nodes.length}`,foot:state.loading?'正在获取数据':`${offline} 个离线 · ${state.nodes.length-active.length-offline} 个待更新`,icon:'server'},
    {label:'集群实时下载',value:download.length?bytes(download.reduce((s,r)=>s+Number(r.network.down),0),true):'—',sub:'',foot:`上传 ${upload.length?bytes(upload.reduce((s,r)=>s+Number(r.network.up),0),true):'—'}`,icon:'network'},
    {label:'平均 CPU 使用率',value:cpus.length?(cpus.reduce((s,n)=>s+n,0)/cpus.length).toFixed(1):'—',sub:'%',foot:`${cpus.length} 台服务器参与统计`,icon:'cpu'},
    {label:'集群内存使用率',value:memPct!==null?memPct.toFixed(1):'—',sub:'%',foot:memory.length?`${bytes(memory.reduce((s,r)=>s+r.used,0))} / ${bytes(memory.reduce((s,r)=>s+r.total,0))}`:'等待有效上报',icon:'memory'}
  ];
  patch($('summary'),cards.map((c,i)=>`<article class="summary-card" data-render-key="summary-${i}"><span class="summary-icon">${icon(c.icon)}</span><div class="summary-label">${c.label}</div><div class="summary-value"><span class="${i===1?'inline-speed':''}">${html(c.value)}</span><small>${html(c.sub)}</small></div><div class="summary-foot">${html(c.foot)}</div></article>`).join(''));
  text('hero-state',state.loading?'正在读取服务器':state.connection==='demo'?`${active.length} 台服务器在线 · 演示模式`:state.connection==='live'?`${active.length} 台服务器在线 · 连接正在回响`:connectionNames[state.connection]+' · 等待新数据');
  text('hero-time',new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}));
}

function filteredNodes(){
  const q=state.search.trim().toLocaleLowerCase();
  const result=state.nodes.filter(n=>(state.tab!=='favorites'||state.favorites.has(n.uuid))&&(state.group==='all'||n.group===state.group)&&(state.filter==='all'||getStatus(n.uuid)===state.filter)&&(!q||[n.name,n.group,n.region,n.os,n.cpu_name,...n.tags].join(' ').toLocaleLowerCase().includes(q)));
  const sortMetric=n=>{const r=getReport(n.uuid);if(getStatus(n.uuid)!=='online')return -1;return state.sort==='cpu'?(numeric(r?.cpu?.usage)??-1):state.sort==='ram'?(percent(r?.ram?.used,capacity(r?.ram?.total,n.mem_total))??-1):trafficUsage(n,r)??-1;};
  if(state.sort==='name')result.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
  else if(['cpu','ram','traffic'].includes(state.sort))result.sort((a,b)=>sortMetric(b)-sortMetric(a));
  else if(state.sort==='expiry')result.sort((a,b)=>(expiryTime(a.expired_at)??Infinity)-(expiryTime(b.expired_at)??Infinity));
  return result;
}

function nodeAddress(n){const code=window.MikuRegions.nodeCountry(n),name=window.MikuRegions.countryName(code),ip=n.ipv4||n.ipv6||'';return `<div class="node-address">${icon('globe')}<span>${html(name)}${code?' · '+code:''}</span>${ip?`<code title="${html(ip)}">${html(ip)}</code>`:`<span class="address-group">${html(n.group)}</span>`}</div>`;}

function syncGlobe(){
  if(!$('traffic-globe')||!prefs.showGlobe)return;
  if(!globe&&window.MikuTrafficGlobe)globe=new window.MikuTrafficGlobe($('traffic-globe'));
  const active=state.nodes.filter(n=>getStatus(n.uuid)==='online'),located=state.nodes.map(n=>({node:n,location:window.MikuRegions.nodeLocation(n)})).filter(x=>x.location),target=getChinaTarget();
  const speed=n=>Math.max(0,numeric(getReport(n.uuid)?.network?.up)??0);
  const servers=located.map(({node,location})=>({...location,uuid:node.uuid,name:globeName(node),status:getStatus(node.uuid),speed:speed(node)}));
  const routes=servers.filter(server=>server.status==='online'&&server.speed>0).sort((a,b)=>b.speed-a.speed).slice(0,32);
  globe?.setData(routes,target,servers);globe?.setOptions({motion:prefs.motion,rotate:prefs.globeRotate,light:document.documentElement.dataset.appearance==='light',paused:state.paused||!!document.querySelector('dialog[open]')||!['demo','live'].includes(state.connection),rhythm:prefs.rhythm,quality:prefs.globeQuality,glow:prefs.globeGlow/100*1.45,onSelect:(uuid,uuids)=>uuids?.length>1?openGlobeGroup(uuids):openDetail(uuid)});
  if($('china-target').value!==prefs.chinaTarget)$('china-target').value=prefs.chinaTarget;
  syncDestinationEditor();
  text('destination-caption',target.scope==='country'?'当前汇聚：中国 · 全国示意':`当前汇聚：${target.label} · ${target.scope==='custom'?'自定义坐标':'地区代表点'}`);
  $('traffic-globe').setAttribute('aria-label',`可旋转的三维地球，显示服务器位置和在线服务器到${target.label}的流光示意；点击位置查看服务器，同位置数字表示服务器数量。拖动或使用方向键旋转，Home 复位。`);
  text('globe-node-count',state.loading?'—':`${located.length} / ${state.nodes.length}`);
  const measured=active.filter(n=>numeric(getReport(n.uuid)?.network?.up)!==null);
  text('globe-upload',measured.length?bytes(measured.reduce((sum,n)=>sum+speed(n),0),true):'—');
  text('globe-state',isDemo?'演示流向':state.paused?'已暂停':state.connection==='live'?'实时速率':'等待心跳');
  const rotation=$('globe-rotate');patch(rotation,icon(prefs.globeRotate?'pause':'play'));rotation.setAttribute('aria-pressed',String(prefs.globeRotate));rotation.setAttribute('aria-label',prefs.globeRotate?'暂停地球自转':'开启地球自转');rotation.title=rotation.getAttribute('aria-label');
  let markup=located.length?located.map(({node,location})=>{
    const name=globeName(node),source=name!==node.name?`${node.name} · ${location.source}`:location.source;
    return `<div class="globe-route globe-server-row" data-render-key="server-position-${html(node.uuid)}"><button class="globe-server-position" data-globe-server="${html(node.uuid)}" title="定位 ${html(name)} · ${html(source)} · ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}">${flag(node)}<span><strong>${html(name)}</strong><small>${html(source)}</small></span><i class="server-status-dot ${getStatus(node.uuid)}" aria-label="${statusNames[getStatus(node.uuid)]}"></i></button><button type="button" class="globe-server-rename" data-globe-rename="${html(node.uuid)}" aria-label="编辑 ${html(name)} 的标记名称" title="编辑标记名称">${icon('edit')}</button><button class="globe-server-details" data-detail="${html(node.uuid)}" aria-label="打开 ${html(node.name)} 详情">${icon('chevron')}</button></div>`;
  }).join(''):`<p class="globe-no-routes">${state.loading?'正在读取服务器…':state.nodes.length?'服务器区域或坐标缺失，暂时无法定位。':'等待服务器信息。'}</p>`;
  if(state.nodes.length>located.length)markup+=`<small class="globe-missing">${state.nodes.length-located.length} 台服务器缺少可定位的地区或坐标</small>`;
  if(servers.filter(server=>server.status==='online'&&server.speed>0).length>32)markup+='<small class="globe-missing">流光展示上传速率最高的 32 台服务器；位置标记保留全部可定位服务器</small>';
  patch('globe-routes',markup);
}
function openGlobeGroup(uuids){
  const servers=state.nodes.filter(server=>uuids.includes(server.uuid));if(!servers.length)return;if(servers.length===1){openDetail(servers[0].uuid);return;}
  const location=window.MikuRegions.nodeLocation(servers[0]);
  patch('globe-group-content',`<div class="dialog-header"><div><h2 id="globe-group-title">此位置的 ${servers.length} 台服务器</h2><p>${html(location?.source||'位置标记')} · ${location?location.lat.toFixed(4)+', '+location.lng.toFixed(4):''}</p></div><button class="icon-button" data-close="globe-group-dialog" aria-label="关闭位置列表">${icon('close')}</button></div><div class="globe-group-servers">${servers.map(server=>`<div class="globe-group-row"><button class="globe-group-detail" data-detail="${html(server.uuid)}">${flag(server)}<span>${html(globeName(server))}${globeName(server)!==server.name?`<small>${html(server.name)}</small>`:''}</span>${statusBadge(server.uuid)}${icon('chevron')}</button><button type="button" class="globe-server-rename" data-globe-rename="${html(server.uuid)}" aria-label="编辑 ${html(globeName(server))} 的标记名称" title="编辑标记名称">${icon('edit')}</button></div>`).join('')}</div>`);
  showDialog('globe-group-dialog');
}
function globeName(server){return globeLabels[server.uuid]||server.name;}
function openGlobeLabelEditor(uuid){
  const server=state.nodes.find(server=>server.uuid===uuid);if(!server){toast('该服务器已不在列表中。');return;}
  if($('globe-group-dialog').open)$('globe-group-dialog').close();
  state.globeLabelUUID=uuid;text('globe-label-server',`服务器原名：${server.name}`);
  const input=$('globe-label-name');input.value=globeLabels[uuid]||'';input.placeholder=server.name;input.setAttribute('aria-invalid','false');
  $('globe-label-error').hidden=true;showDialog('globe-label-dialog');input.focus();input.select?.();
}
function saveGlobeLabel(restore=false){
  const uuid=state.globeLabelUUID,server=state.nodes.find(server=>server.uuid===uuid);
  if(!server){text('globe-label-error','该服务器已不在列表中，请关闭后重新选择。');$('globe-label-error').hidden=false;return false;}
  const name=restore?'':parseGlobeLabel($('globe-label-name').value);
  if(name===null){text('globe-label-error','请使用 32 个字符以内的名称，不包含换行或控制字符。');$('globe-label-error').hidden=false;$('globe-label-name').setAttribute('aria-invalid','true');$('globe-label-name').focus();return false;}
  if(name&&name!==server.name)globeLabels[uuid]=name;else delete globeLabels[uuid];
  const saved=safeWrite(GLOBE_LABEL_KEY,globeLabels);state.globeLabelUUID=null;$('globe-label-dialog').close();syncGlobe();
  toast(saved?name&&name!==server.name?'标记名称已保存':'已恢复服务器原名':'名称已更新，但浏览器无法保存；刷新后将恢复上次保存的名称。');
  return true;
}
function tasksWithRecords(data){const tasks=new Map();for(const t of data.tasks||[])if(t&&t.id!==null&&t.id!==undefined)tasks.set(String(t.id),t);for(const r of data.records||[])if(r.task_id!==null&&r.task_id!==undefined&&!tasks.has(String(r.task_id)))tasks.set(String(r.task_id),{id:r.task_id,name:'任务 '+r.task_id});return [...tasks.values()];}
async function fetchNodePing(uuid,hours=1,signal){
  if(isDemo)return demoPing(uuid,hours);
  const generation=initGeneration;
  if(!publicPingTasks&&!pingTaskPromise){pingTaskPromise=apiGet('/api/task/ping').then(data=>{if(generation===initGeneration)publicPingTasks=Array.isArray(data)?data:[];return Array.isArray(data)?data:[];}).catch(()=>[]).finally(()=>{if(generation===initGeneration)pingTaskPromise=null;});}
  const [data,tasks]=await Promise.all([getPing(uuid,hours,signal),publicPingTasks?Promise.resolve(publicPingTasks):pingTaskPromise||Promise.resolve([])]);
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const known=new Map((tasks||[]).map(t=>[String(t.id),t]));for(const t of data.tasks||[])known.set(String(t.id),{...known.get(String(t.id)),...t});
  data.tasks=tasksWithRecords({...data,tasks:[...known.values()].filter(t=>!Array.isArray(t.clients)||t.clients.includes(uuid)||data.records.some(r=>String(r.task_id)===String(t.id)))});
  return data;
}

function lossSeries(records,windowMs=300000){
  const points=recordSeries(records,r=>r.value),samples=[];let start=0,failed=0;
  return points.map(point=>{
    while(start<samples.length&&samples[start].time<point.time-windowMs){if(samples[start].failed)failed--;start++;}
    if(point.value===null)return {time:point.time,value:null};
    const lost=point.value<0;samples.push({time:point.time,failed:lost});if(lost)failed++;
    return {time:point.time,value:failed/(samples.length-start)*100,failed:lost};
  });
}
const pingRowCache=new WeakMap();
function pingRows(data){
  if(pingRowCache.has(data))return pingRowCache.get(data);
  const rows=tasksWithRecords(data).map(task=>{
    const records=data.records.filter(r=>String(r.task_id)===String(task.id)),points=recordSeries(records,r=>r.value),lossPoints=lossSeries(records),last=points.at(-1),stats=pingStats(records);
    return {task,records,points,lossPoints,last,stats};
  }).sort((a,b)=>Number(/中国|CN|电信|联通|移动|telecom|unicom|cmcc/i.test(b.task.name))-Number(/中国|CN|电信|联通|移动|telecom|unicom|cmcc/i.test(a.task.name)));
  pingRowCache.set(data,rows);return rows;
}
function pingMetric(label,value,points,options,quality=''){
  return `<span class="ping-metric"><span class="ping-metric-head"><small>${label}</small><strong class="${quality}">${value}</strong></span><span class="ping-mini">${prefs.rhythm?window.MikuMusic.mini(points,{...options,escape:html}):chart(points,{mini:true,height:30,...options})}</span></span>`;
}
function renderInlinePing(n,compact=false){
  const cache=inlinePings.get(n.uuid),data=cache?.data,status=getStatus(n.uuid),stale=state.paused||!['live','demo'].includes(state.connection)||!!cache&&Date.now()-cache.fetchedAt>90000;
  const header=compact?'':`<div class="inline-ping-heading" data-render-key="ping-heading"><button data-ping-detail="${html(n.uuid)}">${icon(prefs.rhythm?'music':'pulse')}延迟 / 丢包<small>${stale?'待刷新':isDemo?'模拟采样':'近 1 小时'}</small></button><button class="ping-refresh" data-load-ping="${html(n.uuid)}" aria-label="刷新 ${html(n.name)} 延迟与丢包采样" title="读取最新 Agent Ping 记录" ${cache?.loading?'disabled':''}>${icon('refresh')}</button></div>`;
  if(!data){const note=cache?.error?'采样读取失败':cache?.loading?'正在读取采样…':'等待公开 Ping 采样';return header+`<div class="ping-empty">${html(note)}${cache?.error?`<button data-load-ping="${html(n.uuid)}" title="${html(cache.error)}">重试</button>`:''}</div>`;}
  const rows=pingRows(data);if(!rows.some(x=>x.records.length))return header+'<p class="ping-empty">暂无公开采样 · 请在后台配置 Ping 任务</p>';
  const displayed=rows.filter(x=>x.records.length).slice(0,compact?1:3);
  return header+`<div class="inline-ping-rows" data-render-key="ping-rows">${displayed.map(({task,points,lossPoints,last,stats},index)=>{
    const v=last?.value??null,old=last&&Date.now()-last.time>Math.max(180000,(numeric(task.interval)??60)*3000),value=v===null?'—':v<0?'超时':v.toFixed(0)+' ms',quality=v===null?'muted':v<0||v>150?'poor':v>70?'fair':'good';
    return `<button class="inline-ping-row ${prefs.rhythm?'music-track':''}" data-ping-task-id="${html(task.id)}" data-ping-detail="${html(n.uuid)}" title="${html(task.name)} · 数值：近 1 小时统计；丢包曲线：5 分钟滚动丢包率 · ${last?new Date(last.time).toLocaleTimeString():'无采样'}"><span class="ping-task-name">${prefs.rhythm?`<small class="track-index">${String(index+1).padStart(2,'0')} / TRACK</small>`:''}<span>${html(task.name||'任务 '+task.id)}</span></span>${pingMetric('延迟',value+(old?' *':''),points,{unit:' ms',label:task.name+'延迟',color:'var(--accent)'},quality)}${pingMetric('丢包',stats.loss===null?'—':stats.loss.toFixed(1)+'%',lossPoints,{unit:'%',max:100,label:task.name+'丢包率',color:'var(--pink)'},stats.loss>0?'poor':'good')}</button>`;
  }).join('')}</div>`+(cache.error?'<div class="ping-stale">更新失败，保留上次采样</div>':status!=='online'?'<div class="ping-stale">历史采样 · 当前服务器未确认在线</div>':'')+(rows.filter(x=>x.records.length).length>displayed.length?`<button class="ping-more" data-ping-detail="${html(n.uuid)}">查看全部 ${rows.filter(x=>x.records.length).length} 个任务 ${icon('chevron')}</button>`:'');
}
function updateInlinePingDOM(uuid){const n=state.nodes.find(n=>n.uuid===uuid);if(!n)return;for(const el of document.querySelectorAll('[data-ping-node]'))if(el.dataset.pingNode===uuid)patch(el,renderInlinePing(n,el.classList.contains('table-ping')));}
function queueInlinePing(uuid,force=false){if(pingJobs.has(uuid)||pingQueue.includes(uuid))return;const previous=inlinePings.get(uuid),age=previous?Date.now()-previous.fetchedAt:Infinity;if(!force&&age<(previous?.error?90000:60000))return;inlinePings.set(uuid,{...previous,fetchedAt:previous?.fetchedAt||0,loading:true,error:null});pingQueue.push(uuid);updateInlinePingDOM(uuid);}
function ensureInlinePings(nodes){if(document.hidden||state.paused||!['live','demo'].includes(state.connection))return;for(const n of nodes)queueInlinePing(n.uuid);pumpInlinePings();}
function pumpInlinePings(){
  while(pingActive<3&&pingQueue.length){const uuid=pingQueue.shift(),controller=new AbortController(),generation=initGeneration,cache=inlinePings.get(uuid);pingJobs.set(uuid,controller);pingActive++;
    fetchNodePing(uuid,1,controller.signal).then(data=>{if(!controller.signal.aborted&&generation===initGeneration){cache.data=data;cache.error=null;cache.fetchedAt=Date.now();}}).catch(e=>{if(!controller.signal.aborted&&generation===initGeneration){cache.error=e.message;cache.fetchedAt=Date.now();}}).finally(()=>{if(pingJobs.get(uuid)!==controller)return;pingJobs.delete(uuid);pingActive=Math.max(0,pingActive-1);cache.loading=false;updateInlinePingDOM(uuid);pumpInlinePings();});
  }
}
function cancelInlinePings(){for(const c of pingJobs.values())c.abort();pingJobs.clear();pingActive=0;pingQueue.length=0;for(const cache of inlinePings.values())cache.loading=false;}

function renderPingDetail(data,node,hours){
  if(!data?.records?.length)return emptyState('还没有延迟与丢包采样','请在 Komari 后台配置公开 Ping 任务，等待 Agent 采集。');
  return `<p class="ping-detail-note">${isDemo?'模拟演示数据':'Agent 公开 Ping 任务'} · 最近 ${hours} 小时 · 丢包数值统计整个范围，曲线为 5 分钟滚动丢包率</p>`+pingRows(data).filter(row=>row.records.length).map(({task,points,lossPoints,stats,last})=>`<section class="ping-detail-task" data-ping-task-id="${html(task.id)}"><div class="chart-section-title"><strong>${html(task.name)}</strong><span>${html(task.type||'Ping')} · ${last?formatDate(new Date(last.time).toISOString()):'—'}</span></div><div class="ping-stats">${smallMetric('最新延迟',numeric(last?.value)===null?'—':last.value<0?'超时':last.value.toFixed(1)+' ms')}${smallMetric('平均延迟',stats.average===null?'—':stats.average.toFixed(1)+' ms')}${smallMetric('P95',stats.p95===null?'—':stats.p95.toFixed(1)+' ms')}${smallMetric('丢包率',stats.loss===null?'—':stats.loss.toFixed(2)+'%')}</div><div class="ping-chart-pair">${historyChart('延迟',points,{unit:' ms',key:'latency'})}${historyChart('丢包率 · 5 分钟滚动',lossPoints,{unit:'%',max:100,color:'var(--pink)',key:'loss'})}</div></section>`).join('')+`<p class="ping-foot">${html(node.name)} · 负值采样计入丢包，不计入延迟；缺失值保留曲线缺口。* 表示卡片采样已过期。由 Agent 定时测量，首页约每 60 秒读取一次。</p>`;
}
function renderCard(n){
  const status=getStatus(n.uuid), raw=getReport(n.uuid), r=status==='online'?raw:null;
  const cpu=numeric(r?.cpu?.usage), ram=percent(nonnegative(r?.ram?.used),capacity(r?.ram?.total,n.mem_total)), disk=percent(nonnegative(r?.disk?.used),capacity(r?.disk?.total,n.disk_total));
  const spark=state.samples.get(n.uuid)||[];
  const titleSub=[n.os,n.virtualization].filter(Boolean).join(' · ');
  return `<article class="km-node-card ${status}" data-node="${html(n.uuid)}"><div class="node-head"><span class="region-icon" aria-label="地区 ${html(window.MikuRegions.countryName(window.MikuRegions.nodeCountry(n)))}">${flag(n)}</span><div class="node-name-wrap"><button class="node-title" data-detail="${html(n.uuid)}" title="${html(n.name)}">${html(n.name)}</button><div class="node-sub">${html(titleSub||'系统信息待上报')}</div></div>${statusBadge(n.uuid)}${favoriteButton(n.uuid)}</div><div class="node-meta-line"><span class="cpu-model" title="${html(n.cpu_name)}">${html(n.cpu_name||'CPU 未知')}</span><span>${html(n.cpu_cores||'—')} vCPU · ${bytes(n.mem_total)}</span></div>${nodeAddress(n)}<div class="metrics">${metricRow('CPU',cpu,'','cpu','cpu')}${metricRow('内存',ram,r?`${bytes(r.ram?.used)} / ${bytes(capacity(r.ram?.total,n.mem_total))}`:bytes(n.mem_total),'memory','memory')}${metricRow('磁盘',disk,r?`${bytes(r.disk?.used)} / ${bytes(capacity(r.disk?.total,n.disk_total))}`:bytes(n.disk_total),'disk','disk')}</div><div class="node-network"><span class="network-rate">${icon('down')}下载 <strong>${bytes(r?.network?.down,true)}</strong></span><span class="network-rate upload">${icon('up')}上传 <strong>${bytes(r?.network?.up,true)}</strong></span></div>${trafficMarkup(n,raw,status)}${billingMarkup(n,true)}${prefs.showPing?`<section class="inline-ping" data-render-key="inline-ping" data-ping-node="${html(n.uuid)}" aria-label="${html(n.name)}延迟与丢包">${renderInlinePing(n)}</section>`:''}${status==='online'&&spark.length>1?`<div class="card-spark" data-render-key="cpu-spark">${chart(spark,{mini:true,height:24,max:100,label:'CPU'})}</div>`:''}<div class="node-bottom" data-render-key="node-bottom"><span class="uptime">${icon('clock')}${status==='online'?uptime(r?.uptime):status==='offline'?`上次上报 ${briefAge(raw?.updated_at)}`:'等待实时数据'}</span><button data-detail="${html(n.uuid)}">详细监控${icon('chevron')}</button></div><div class="tiny-tags">${n.tags.length?n.tags.map(t=>`#${html(t)}`).join(' &nbsp; '):html(n.group)}</div></article>`;
}

function renderTable(nodes){
  return `<div class="panel table-wrap"><table class="node-table km-ui-table"><thead><tr><th scope="col">服务器</th><th scope="col">状态</th><th scope="col">CPU</th><th scope="col">内存</th><th scope="col">磁盘</th><th scope="col">↓ 下载</th><th scope="col">↑ 上传</th><th scope="col">流量</th><th scope="col">服务器价格</th><th scope="col">到期时间</th><th scope="col">运行时间</th>${prefs.showPing?'<th scope="col">延迟 / 丢包</th>':''}<th scope="col"><span class="muted">收藏</span></th></tr></thead><tbody>${nodes.map(n=>{const status=getStatus(n.uuid),raw=getReport(n.uuid),r=status==='online'?raw:null;return `<tr data-node-row="${html(n.uuid)}" class="${status==='offline'?'table-row-offline':''}"><td><div class="table-node"><span class="region-icon">${flag(n)}</span><div><button class="node-title" data-detail="${html(n.uuid)}">${html(n.name)}</button><span class="node-sub">${html(n.group)} · ${n.cpu_cores||'—'} vCPU</span></div></div></td><td>${statusBadge(n.uuid)}</td><td class="table-metric">${pct(r?.cpu?.usage)}</td><td class="table-metric">${pct(percent(r?.ram?.used,capacity(r?.ram?.total,n.mem_total)))}</td><td class="table-metric">${pct(percent(r?.disk?.used,capacity(r?.disk?.total,n.disk_total)))}</td><td>${bytes(r?.network?.down,true)}</td><td>${bytes(r?.network?.up,true)}</td><td class="table-traffic" data-server-flow="${html(n.uuid)}"><strong>${bytes(trafficUsage(n,raw))}${capacity(n.traffic_limit)?' / '+bytes(n.traffic_limit):''}</strong><small>↑ ${bytes(raw?.network?.totalUp)} · ↓ ${bytes(raw?.network?.totalDown)}${status==='online'?'':' · 历史累计'}</small></td><td class="table-billing">${html(priceText(n))}</td><td class="table-expiry ${expiryTime(n.expired_at)!==null&&expiryTime(n.expired_at)-Date.now()<7*86400000?'expiry-urgent':''}"><strong>${html(expiryDate(n.expired_at))}</strong><small>${html(expiryText(n.expired_at))}</small></td><td>${uptime(r?.uptime)}</td>${prefs.showPing?`<td><div class="inline-ping table-ping" data-ping-node="${html(n.uuid)}">${renderInlinePing(n,true)}</div></td>`:''}<td>${favoriteButton(n.uuid)}</td></tr>`;}).join('')}</tbody></table></div>`;
}

function render(){
  attr(document.documentElement,'data-playing',!document.hidden&&!state.paused&&['demo','live'].includes(state.connection)?'on':'off');
  const connection=$('connection');attr(connection,'class','connection-pill '+(['reconnecting','stale','error'].includes(state.connection)?'bad':['connecting','paused'].includes(state.connection)?'neutral':''));
  patch(connection,`<i class="dot ${state.connection==='live'?'live-dot':''}"></i><span>${connectionNames[state.connection]}</span>`);
  text('last-update',state.lastUpdate?`更新于 ${new Date(state.lastUpdate).toLocaleTimeString('zh-CN',{hour12:false})}`:'等待更新');
  patch('pause-button',icon(state.paused?'play':'pause'));$('pause-button').setAttribute('aria-label',state.paused?'恢复实时更新':'暂停实时更新');
  $('pause-button').title=state.paused?'恢复实时更新':'暂停实时更新';
  text('node-count',state.nodes.length);text('favorite-count',state.nodes.filter(n=>state.favorites.has(n.uuid)).length);
  renderSummary();syncGlobe();
  $('error-banner').hidden=!state.error && !(['reconnecting','stale','error'].includes(state.connection)&&state.snapshot);
  if(!$('error-banner').hidden)patch($('error-banner'),`<div class="error-banner" role="alert">${icon('info')}<span>${html(state.error?.message||'实时连接已中断。保留最后一次数据，服务器状态等待重新确认。')}</span><button data-action="${needsLogin()?'login':'refresh'}">${needsLogin()?'登录':'重试'}</button></div>`);
  const groups=[...new Set(state.nodes.map(n=>n.group))];
  patch($('groups'),`<button class="group-button ${state.group==='all'?'active':''}" data-group="all">全部服务器 <span class="muted">${state.nodes.length}</span></button>`+groups.map(g=>`<button class="group-button ${state.group===g?'active':''}" data-group="${html(g)}">${html(g)} <span class="muted">${state.nodes.filter(n=>n.group===g).length}</span></button>`).join(''));
  const nodes=filteredNodes(), container=$('nodes-container');attr(container,'class',`${state.view==='grid'?'node-grid':'node-list'} km-instance-server-list`);
  if(state.loading)patch(container,Array.from({length:6},()=>'<div class="panel skeleton-card"><div class="skeleton wide"></div><div class="skeleton short"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>').join(''));
  else if(state.error&&!state.nodes.length)patch(container,emptyState('暂时无法连接',state.error.message,`<button class="primary-button" data-action="${needsLogin()?'login':'refresh'}">${needsLogin()?'登录 Komari':'重新连接'}</button>`));
  else if(!state.nodes.length)patch(container,emptyState('等待第一份回响','还没有可见服务器。管理员添加 Agent 后，这里会自动出现。',state.me.logged_in?'<a class="primary-button" href="/admin">打开管理后台</a>':''));
  else if(!nodes.length)patch(container,emptyState(state.tab==='favorites'&&!state.favorites.size?'把喜欢的服务器留在这里':'没有匹配的服务器',state.tab==='favorites'&&!state.favorites.size?'点击服务器右上角的星星，建立自己的关注列表。':'试试其他分组、状态或关键词。','<button class="secondary-button" data-action="reset-filters">查看全部服务器</button>'));
  else patch(container,state.view==='table'?renderTable(nodes):nodes.map(renderCard).join(''));
  if(!state.loading&&state.tab!=='network'&&prefs.showPing)ensureInlinePings(nodes);
  text('filter-count',`显示 ${nodes.length} / ${state.nodes.length} 台服务器${isDemo?' · 示例服务器与模拟曲线':''}`);
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-pressed',b.dataset.view===state.view);});
  $('admin-link').title=state.me.logged_in?'Komari 管理后台':'登录 Komari';
  $('logout-link').hidden=!state.me.logged_in;
  refreshDetailLive();
}
function scheduleRender(){
  if(renderQueued)return;renderQueued=true;
  requestAnimationFrame(()=>{
    renderQueued=false;const active=document.activeElement,keys=['detail','favorite','group','pingDetail','loadPing'];
    const key=keys.find(k=>active?.dataset?.[k]),value=key?active.dataset[key]:null;
    const candidates=key?[...document.querySelectorAll('button')].filter(e=>e.dataset[key]===value):[],index=candidates.indexOf(active);
    render();
    if(key&&document.activeElement!==active){if(active.isConnected)active.focus({preventScroll:true});else{const replacements=[...document.querySelectorAll('button')].filter(e=>e.dataset[key]===value);(replacements[Math.max(0,index)]||replacements[0])?.focus({preventScroll:true});}}
  });
}

function renderWallpapers(){
  const draft=typeof $('wallpaper-url')?.value==='string'?$('wallpaper-url').value:prefs.backgroundURL;
  const active=prefs.backgroundSource,custom=currentWallpaper()!==asset(prefs.wallpaper+'.webp'),source=custom?(active==='local'?'本地图片':'图片链接'):active==='builtin'?'内置背景':'内置背景（暂用）';
  patch($('wallpaper-options'),`<div class="custom-wallpaper-preview"><img id="wallpaper-preview" src="${html(currentWallpaper())}" alt="当前背景预览"><span>当前背景 · ${source}</span></div><div class="setting-section custom-wallpaper"><h3>自定义背景</h3><div class="wallpaper-upload"><label for="wallpaper-file">本地上传</label><input id="wallpaper-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif" aria-describedby="wallpaper-file-help" ${background.busy?'disabled':''}><p id="wallpaper-file-help">支持 JPG / PNG / WebP / GIF / AVIF，最大 10 MiB。图片保存在当前浏览器，刷新后可继续使用。</p><div class="wallpaper-saved"><span>${html(background.local?.name||'尚未保存本地图片')}</span><button type="button" class="text-button" data-action="use-saved-wallpaper" ${!background.local||background.busy?'disabled':''}>${active==='local'?'重新使用':'使用已保存图片'}</button></div></div><form id="wallpaper-url-form" class="wallpaper-url-form"><label for="wallpaper-url">图片链接</label><div><input id="wallpaper-url" type="url" required maxlength="4096" placeholder="https://example.com/background.jpg" value="${html(draft)}" autocomplete="off" spellcheck="false" aria-describedby="wallpaper-url-help"><button type="submit" class="secondary-button" ${background.busy?'disabled':''}>应用链接</button></div><p id="wallpaper-url-help">填写可直接打开图片的链接；验证成功后才替换背景。</p></form><p class="wallpaper-loading" role="status" ${background.busy?'':'hidden'}>正在检查并保存图片…</p><p class="wallpaper-error" role="alert" ${background.error?'':'hidden'}>${html(background.error)}</p></div><div class="setting-section builtin-wallpapers"><h3>内置背景</h3><div class="wallpaper-grid">${WALLPAPERS.map(w=>`<button class="wallpaper-choice ${active==='builtin'&&prefs.wallpaper===w.id?'active':''}" data-wallpaper="${w.id}" aria-pressed="${active==='builtin'&&prefs.wallpaper===w.id}"><img src="${asset(w.id+'-thumb.webp')}" alt="${w.name}背景缩略图" width="400" height="245"><div class="wallpaper-caption"><div>${w.name}<small>${w.subtitle}</small></div>${active==='builtin'&&prefs.wallpaper===w.id?icon('check'):''}</div></button>`).join('')}</div></div><div class="range-row"><label class="range-label" for="dim-range">背景遮罩 <output id="dim-output">${prefs.dim}%</output></label><input id="dim-range" type="range" min="20" max="95" value="${prefs.dim}"></div><div class="range-row"><label class="range-label" for="blur-range">背景模糊 <output id="blur-output">${prefs.blur}px</output></label><input id="blur-range" type="range" min="0" max="16" value="${prefs.blur}"></div>${switchRow('rotate','自动轮换内置背景','内置背景每 60 秒轮换；自定义图片不参与轮换。')}<div class="source-credit">自定义背景仅在当前浏览器生效；内置背景随主题打包。</div><div class="dialog-footer"><button class="text-button" data-action="restore-background">恢复背景默认值</button><button class="primary-button" data-close="wallpaper-dialog">就用这个世界</button></div>`);
}
function switchRow(key,title,description){return `<div class="setting-row"><div><div class="setting-title" id="label-${key}">${title}</div><div class="setting-description">${description}</div></div><button type="button" class="switch" role="switch" data-pref="${key}" aria-checked="${prefs[key]}" aria-labelledby="label-${key}"></button></div>`;}
function rangeSetting(key,title,min,max,unit){return `<div class="range-row"><label class="range-label" for="${key}-range">${title}<output id="${key}-output">${prefs[key]}${unit}</output></label><input id="${key}-range" type="range" min="${min}" max="${max}" value="${prefs[key]}" data-range-pref="${key}" data-unit="${unit}"></div>`;}
function nodeSizeSettings(){return `<div class="setting-section node-size-setting"><h3>Miku · 服务器显示尺寸</h3><p id="node-size-help" class="setting-description">卡片宽度、留白、字号和曲线一起调整，表格行也同步生效；窄屏自动减少列数。</p><div class="node-size-picker" role="group" aria-label="服务器显示尺寸" aria-describedby="node-size-help">${NODE_SIZES.map(s=>`<button type="button" class="node-size-choice ${prefs.nodeSize===s.id?'active':''}" data-node-size="${s.id}" aria-pressed="${prefs.nodeSize===s.id}"><span class="node-size-sample sample-${s.id}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${s.name}${s.id==='compact'?'<em>推荐</em>':''}</strong><small>${s.description}</small></button>`).join('')}</div><p class="node-size-note">极简收起系统、CPU 型号、标签和迷你曲线；CPU、内存、磁盘、流量、价格、到期及延迟/丢包数值仍保留，完整信息可点「详细监控」。</p></div>`;}
function setNodeSize(value){
  if(!NODE_SIZES.some(s=>s.id===value))return;
  prefs.nodeSize=value;prefs.compact=['mini','compact'].includes(value);nodeSizeChosen=true;
  applyPreferences();persistPreferences();
  document.querySelectorAll('button[data-node-size]').forEach(b=>{const active=b.dataset.nodeSize===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function renderSettings(){
  patch($('settings-options'),`<div class="setting-row"><div class="setting-title">外观模式</div><div class="appearance-picker">${[['light','sun','浅色'],['dark','moon','深色'],['system','monitor','系统']].map(([v,i,t])=>`<button class="${appearance===v?'active':''}" data-appearance="${v}" aria-pressed="${appearance===v}">${icon(i)}${t}</button>`).join('')}</div></div>${nodeSizeSettings()}<div class="setting-section"><h3>Miku · 玻璃与透明度</h3>${switchRow('glass','毛玻璃效果','对背景实时模糊，拖动滑杆立即预览。')}${rangeSetting('panelOpacity','面板不透明度',10,100,'%')}${rangeSetting('glassBlur','毛玻璃强度',0,40,'px')}${rangeSetting('borderStrength','玻璃边框亮度',0,100,'%')}<div class="glass-presets">${[['clear','清透'],['frost','柔雾'],['solid','清晰']].map(([v,t])=>`<button class="secondary-button" data-glass-preset="${v}">${t}</button>`).join('')}</div></div><div class="setting-section"><h3>Miku · 连接伙伴</h3>${switchRow('mascot','显示吉祥物','四位初音伙伴，点击首页的「换个伙伴」快速切换。')}<div class="mascot-picker">${MASCOTS.map(m=>`<button class="mascot-choice ${prefs.mascotId===m.id?'active':''}" data-mascot-id="${m.id}" aria-pressed="${prefs.mascotId===m.id}"><img src="${asset(m.file)}" alt="${m.name}" width="100" height="105" loading="lazy"><span>${m.name}</span></button>`).join('')}</div></div><div class="setting-section"><h3>Miku · 音乐与地球</h3>${switchRow('rhythm','采样节拍','延迟音量柱、丢包断拍和音轨装饰；柱高始终来自真实采样。')}<label class="quality-setting">地球画质<select id="globe-quality"><option value="auto" ${prefs.globeQuality==='auto'?'selected':''}>自适应</option><option value="high" ${prefs.globeQuality==='high'?'selected':''}>细腻</option><option value="eco" ${prefs.globeQuality==='eco'?'selected':''}>省电</option></select></label>${rangeSetting('globeGlow','地球辉光',0,100,'%')}${switchRow('showPing','延迟与丢包曲线','在探针卡片中并排展示延迟、丢包及两条迷你曲线。')}${switchRow('showGlobe','三维流量地球','默认流向中国全国；在地球旁选择省级地区或自定义区域。')}${switchRow('globeRotate','地球自动旋转','关闭自转后仍可拖动；流光由轻盈动效控制。')}${switchRow('motion','轻盈动效','控制吉祥物、流光、自转和过渡；尊重系统减少动态效果。')}${switchRow('focus','专注监控','简化背景和装饰，让数据成为主角。')}</div><div class="dialog-note">设置自动保存在当前浏览器。延迟来自 Agent 的公开 Ping 任务；未配置时请在 Komari 后台添加任务。</div><div class="dialog-footer"><button class="text-button" data-action="restore-settings">恢复默认设置</button><button class="primary-button" data-close="settings-dialog">完成</button></div>`);
}

function switchTab(tab){
  state.tab=tab;$('nodes-panel').hidden=tab==='network';$('network-panel').hidden=tab!=='network';
  document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===tab;b.classList.toggle('active',selected);b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;});
  $('nodes-panel').setAttribute('aria-labelledby',tab==='favorites'?'tab-favorites':'tab-nodes');
  if(tab==='network'){if(!state.network.uuid&&state.nodes.length)state.network.uuid=state.nodes[0].uuid;renderNetwork();loadNetwork();}else{networkController?.abort();scheduleRender();}
}

function infoRow(label,value){return `<div class="info-row"><dt>${html(label)}</dt><dd>${html(value===null||value===undefined||value===''?'—':value)}</dd></div>`;}
function smallMetric(label,value,sub=''){return `<div class="detail-metric"><small>${html(label)}</small><strong>${html(value)}</strong>${sub?`<em>${html(sub)}</em>`:''}</div>`;}
function detailMetrics(n,r,tab){
  if(tab==='network')return smallMetric('实时下载',bytes(r?.network?.down,true))+smallMetric('实时上传',bytes(r?.network?.up,true))+smallMetric('累计下载',bytes(r?.network?.totalDown))+smallMetric('累计上传',bytes(r?.network?.totalUp));
  return smallMetric('CPU 使用率',pct(r?.cpu?.usage),`${n.cpu_cores||'—'} vCPU`)+smallMetric('内存使用率',pct(percent(r?.ram?.used,capacity(r?.ram?.total,n.mem_total))),`${bytes(r?.ram?.used)} / ${bytes(capacity(r?.ram?.total,n.mem_total))}`)+smallMetric('磁盘使用率',pct(percent(r?.disk?.used,capacity(r?.disk?.total,n.disk_total))),`${bytes(r?.disk?.used)} / ${bytes(capacity(r?.disk?.total,n.disk_total))}`)+smallMetric('系统负载',numeric(r?.load?.load1)?.toFixed(2)??'—','1 分钟平均负载');
}
function refreshDetailLive(){
  if(!$('detail-dialog').open||!state.detail.uuid)return;
  const n=state.nodes.find(n=>n.uuid===state.detail.uuid);if(!n)return;
  const r=getReport(n.uuid),status=getStatus(n.uuid);
  if($('detail-live-status'))$('detail-live-status').textContent=`${n.group} · ${n.os||'未知系统'} · ${statusNames[status]}`;
  if($('detail-live-metrics'))patch('detail-live-metrics',detailMetrics(n,r,state.detail.tab));
  if($('detail-live-traffic'))patch('detail-live-traffic',trafficMarkup(n,r,status));
  if($('detail-live-warning')){$('detail-live-warning').hidden=status==='online';$('detail-live-warning').textContent=`${status==='offline'?'服务器当前离线':'实时数据尚未确认'}。以下为最后一次上报（${formatDate(r?.updated_at)}）；历史曲线来自已存储的采样。`;}
}
function renderDetail(){
  const d=state.detail,n=state.nodes.find(n=>n.uuid===d.uuid);if(!n)return;
  const r=getReport(n.uuid),status=getStatus(n.uuid),memPct=percent(r?.ram?.used,capacity(r?.ram?.total,n.mem_total));
  const top=`<div class="dialog-header"><div class="detail-top"><span class="region-icon">${flag(n)}</span><div><h2 id="detail-title">${html(n.name)}</h2><p id="detail-live-status">${html(n.group)} · ${html(n.os||'未知系统')} · ${statusNames[status]}</p></div></div><button class="icon-button" data-close="detail-dialog" aria-label="关闭服务器详情">${icon('close')}</button></div><div class="detail-badges"><span>${html(n.cpu_cores||'—')} vCPU</span><span>${bytes(n.mem_total)} RAM</span><span>${html(n.arch||'—')}</span>${n.tags.map(t=>`<span>${html(t)}</span>`).join('')}</div><div class="detail-tabs" role="tablist" aria-label="服务器详情">${[['overview','资源趋势'],['network','网络与流量'],['ping','延迟 / 丢包'],['info','服务器信息']].map(([t,label])=>`<button role="tab" aria-selected="${d.tab===t}" class="${d.tab===t?'active':''}" data-detail-tab="${t}" tabindex="${d.tab===t?'0':'-1'}">${label}</button>`).join('')}${d.tab!=='info'?`<select id="detail-hours" aria-label="历史时间范围">${[1,6,24,72].map(h=>`<option value="${h}" ${d.hours===h?'selected':''}>最近 ${h} 小时</option>`).join('')}</select>`:''}</div>`;
  let content='';
  const warning=`<div id="detail-live-warning" class="detail-warning" ${status==='online'?'hidden':''}>${status==='offline'?'服务器当前离线':'实时数据尚未确认'}。以下为最后一次上报（${formatDate(r?.updated_at)}）；历史曲线来自已存储的采样。</div>`;
  if(d.tab==='info'){
    content=`<dl class="detail-info">${infoRow('CPU 型号',n.cpu_name)}${infoRow('虚拟化',n.virtualization)}${infoRow('操作系统',n.os)}${infoRow('内核版本',n.kernel_version)}${infoRow('架构',n.arch)}${infoRow('区域',window.MikuRegions.countryName(window.MikuRegions.nodeCountry(n))+' · '+(n.region||'未知'))}${infoRow('内存容量',bytes(n.mem_total))}${infoRow('磁盘容量',bytes(n.disk_total))}${infoRow('Swap 容量',bytes(n.swap_total))}${infoRow('运行时间',uptime(r?.uptime))}${infoRow('到期时间',expiryTime(n.expired_at)!==null?formatDate(n.expired_at):'未设置')}${infoRow('续费状态',n.auto_renewal?'自动续费':'手动续费')}${infoRow('服务器价格',priceText(n))}${infoRow('IPv4',n.ipv4||'访客不可见')}${infoRow('IPv6',n.ipv6||'访客不可见')}${infoRow('服务器 UUID',n.uuid)}</dl>${n.public_remark?`<div class="detail-remark">${html(n.public_remark)}</div>`:''}`;
  }else if(d.tab==='ping'){
    content=d.loading&&!d.ping?'<div class="chart-empty">正在读取延迟与丢包采样…</div>':d.error&&!d.ping?emptyState('延迟记录读取失败',d.error,'<button class="primary-button" data-action="retry-detail">重试</button>'):renderPingDetail(d.ping,n,d.hours)+(d.loading?'<p class="ping-foot" role="status">正在刷新采样，保留当前曲线…</p>':d.error?`<p class="detail-warning" role="alert">${html(d.error)} · 保留上次采样 <button data-action="retry-detail">重试</button></p>`:'');
  }else if(d.tab==='overview'){
    content=`${warning}<div class="detail-metrics" id="detail-live-metrics">${detailMetrics(n,r,d.tab)}</div>${d.loading?'<div class="skeleton"></div>':d.error?`<div class="detail-warning" role="alert">${html(d.error)} <button data-action="retry-detail">重试</button></div>`:`${historyChart('CPU 使用率',recordSeries(d.records,x=>x.cpu),{max:100})}${historyChart('内存使用率',resourceSeries(d.records,'ram',n,r),{max:100,color:'#97adf8'})}${historyChart('磁盘使用率',resourceSeries(d.records,'disk',n,r),{max:100,color:'var(--pink)'})}${historyChart('系统负载',recordSeries(d.records,x=>x.load),{unit:''})}`}<dl class="detail-info">${infoRow('Swap 使用',`${bytes(r?.swap?.used)} / ${bytes(capacity(r?.swap?.total,n.swap_total))}`)}${infoRow('进程数',r?.process)}${infoRow('TCP / UDP',`${r?.connections?.tcp??'—'} / ${r?.connections?.udp??'—'}`)}${infoRow('最近上报',formatDate(r?.updated_at))}</dl>${r?.gpu?.detailed_info?.length?`<h3 class="detail-resource-title">GPU 设备</h3><div class="gpu-grid">${r.gpu.detailed_info.map(g=>`<div class="gpu-card"><strong>${html(g.name)}</strong>利用率 ${pct(g.utilization)} · ${numeric(g.temperature)??'—'}°C<br>显存 ${bytes(g.memory_used)} / ${bytes(g.memory_total)}</div>`).join('')}</div>`:''}${r?.message?`<div class="detail-warning">${html(r.message)}</div>`:''}`;
  }else{
    content=`${warning}<div class="detail-metrics" id="detail-live-metrics">${detailMetrics(n,r,d.tab)}</div><div class="ping-foot">累计值来自 Agent 上报，不等同于自然月账单；流量配额和计费口径由后台配置。</div>${d.loading?'<div class="skeleton"></div>':d.error?`<div class="detail-warning" role="alert">${html(d.error)} <button data-action="retry-detail">重试</button></div>`:`${historyChart('下载速率',recordSeries(d.records,x=>x.net_in),{unit:'B/s'})}${historyChart('上传速率',recordSeries(d.records,x=>x.net_out),{unit:'B/s',color:'#97adf8'})}`}`;
  }
  patch($('detail-content'),top+`<div id="detail-billing-summary">${billingMarkup(n)}</div><div id="detail-live-traffic">${trafficMarkup(n,r,status)}</div>`+content+`<div class="detail-action"><span>${isDemo?'模拟历史采样，仅用于预览':`最近 ${d.hours} 小时 · ${d.records.length} 个历史采样`}</span>${state.me.logged_in?`<a class="secondary-button" href="/terminal?uuid=${encodeURIComponent(n.uuid)}" target="_blank" rel="noopener">打开终端</a>`:''}<button class="secondary-button" data-favorite="${html(n.uuid)}">${icon('star')}${state.favorites.has(n.uuid)?'已收藏':'收藏服务器'}</button></div>`);
}
function historyChart(label,series,opts={}){return `<section class="chart-section" data-render-key="chart-${html(opts.key||label)}"><div class="chart-section-title"><span><i class="dot ${opts.color?'blue':''}"></i>${html(label)}</span><small>鼠标悬停查看采样</small></div>${chart(series,{label,...opts,rhythm:prefs.rhythm&&['latency','loss'].includes(opts.key)})}</section>`;}
async function openDetail(uuid,initialTab='overview'){
  if(!state.nodes.some(n=>n.uuid===uuid))return;
  detailController?.abort();state.detail={uuid,tab:initialTab,hours:1,records:[],ping:null,loading:true,error:null};
  history.replaceState(null,'',location.pathname+location.search+'#node='+encodeURIComponent(uuid));renderDetail();showDialog('detail-dialog');await loadDetail();
}
async function loadDetail(){
  detailController?.abort();const controller=new AbortController();detailController=controller;
  const {uuid,hours,tab}=state.detail;if(!uuid)return;
  const context=uuid+':'+hours;if(state.detail.loadedContext!==context){state.detail.records=[];state.detail.ping=null;}state.detail.loadedContext=context;
  state.detail.loading=true;state.detail.error=null;renderDetail();
  try {if(tab==='ping'){const data=await fetchNodePing(uuid,hours,controller.signal);if(controller.signal.aborted||state.detail.uuid!==uuid)return;state.detail.ping=data;}else{const records=isDemo?demoHistory(uuid,hours):await getHistory(uuid,hours,controller.signal);if(controller.signal.aborted||state.detail.uuid!==uuid)return;state.detail.records=records;}}
  catch(e){if(controller.signal.aborted)return;state.detail.error=e.message;}
  finally {if(!controller.signal.aborted&&state.detail.uuid===uuid){state.detail.loading=false;renderDetail();}}
}


function renderNetwork(){
  const n=state.network,node=state.nodes.find(x=>x.uuid===n.uuid);
  if(!state.nodes.length){patch('network-panel',emptyState('等待网络监测服务器','有服务器并配置公开 Ping 任务后，即可查看延迟与丢包。'));return;}
  const tasks=n.data?.tasks||[],records=n.data?.records||[];
  const filtered=records.filter(r=>n.task==='all'||String(r.task_id)===n.task),stats=pingStats(filtered);
  const chips=`<div class="task-chips" data-render-key="task-chips"><button class="task-chip ${n.task==='all'?'active':''}" data-ping-task="all">全部任务</button>${tasks.map(t=>`<button class="task-chip ${n.task===String(t.id)?'active':''}" data-ping-task="${html(t.id)}">${html(t.name||'任务 '+t.id)}<small>${html(t.type||'')}</small></button>`).join('')}</div>`;
  const series=n.data?pingRows(n.data).filter(row=>n.task==='all'||String(row.task.id)===n.task):[];
  const header=`<div class="network-heading" data-render-key="network-heading"><div><h2>${icon('pulse')}延迟与丢包的每一拍</h2><p>公开 Ping 任务 · 丢包数值统计整个范围，曲线为 5 分钟滚动比例</p></div><div class="network-selectors"><select id="network-node" aria-label="网络监测服务器">${state.nodes.map(x=>`<option value="${html(x.uuid)}" ${x.uuid===n.uuid?'selected':''}>${html(x.name)}</option>`).join('')}</select><select id="network-hours" aria-label="Ping 时间范围">${[1,6,24,72].map(h=>`<option value="${h}" ${h===n.hours?'selected':''}>最近 ${h} 小时</option>`).join('')}</select><button class="icon-button" data-action="refresh-network" aria-label="刷新网络记录">${icon('refresh')}</button></div></div>`;
  const content=n.loading&&!n.data?'<div class="chart-empty">正在读取网络记录…</div>':n.error&&!n.data?emptyState('网络记录读取失败',n.error,'<button class="primary-button" data-action="refresh-network">重试</button>'):!records.length?emptyState('还没有网络采样','请在 Komari 后台配置公开 Ping 任务，并等待 Agent 完成采样。'):chips+`<div class="ping-stats" data-render-key="ping-stats">${smallMetric('平均延迟',stats.average===null?'—':stats.average.toFixed(1)+' ms')}${smallMetric('P95 延迟',stats.p95===null?'—':stats.p95.toFixed(1)+' ms')}${smallMetric('丢包率',stats.loss===null?'—':stats.loss.toFixed(2)+'%')}${smallMetric('测量次数',stats.count)}</div>`+series.map(({task,points,lossPoints})=>`<section class="network-task-pair" data-ping-task-id="${html(task.id)}"><h3>${html(task.name||'任务 '+task.id)}</h3><div class="ping-chart-pair">${historyChart('延迟',points,{unit:' ms',key:'latency'})}${historyChart('丢包率 · 5 分钟滚动',lossPoints,{unit:'%',max:100,color:'var(--pink)',key:'loss'})}</div></section>`).join('')+`<div class="ping-foot">${html(node?.name||'')} · 最近 ${n.hours} 小时${isDemo?' · 演示采样':''} · 多任务汇总按测量次数加权；丢包不计入延迟。</div>`;
  const notice=n.data?(n.loading?'<p class="ping-foot" role="status">正在刷新记录，保留当前曲线…</p>':n.error?`<p class="detail-warning" role="alert">${html(n.error)} · 保留上次采样 <button data-action="refresh-network">重试</button></p>`:''):'';
  patch('network-panel',header+content+notice);
}
async function loadNetwork(){
  if(!state.network.uuid||state.tab!=='network')return;
  networkController?.abort();const controller=new AbortController();networkController=controller;
  const {uuid,hours}=state.network;const context=uuid+':'+hours;if(state.network.loadedContext!==context)state.network.data=null;state.network.loadedContext=context;state.network.loading=true;state.network.error=null;renderNetwork();
  try{
    const data=await fetchNodePing(uuid,hours,controller.signal);
    if(controller.signal.aborted||state.network.uuid!==uuid||state.network.hours!==hours)return;
    state.network.data=data;if(state.network.task!=='all'&&!data.tasks.some(t=>String(t.id)===state.network.task))state.network.task='all';
  }catch(e){if(controller.signal.aborted)return;state.network.error=e.message;}
  finally{if(!controller.signal.aborted){state.network.loading=false;renderNetwork();}}
}

function onSnapshot(snapshot){
  state.snapshot=snapshot;state.lastUpdate=Date.now();
  for(const n of state.nodes){const r=snapshot.reports[n.uuid];if(!snapshot.online.has(n.uuid)||!r)continue;const samples=state.samples.get(n.uuid)||[];samples.push({time:state.lastUpdate,value:numeric(r.cpu?.usage)});if(samples.length>35)samples.shift();state.samples.set(n.uuid,samples);}
  scheduleRender();
}
async function initialize(){
  const generation=++initGeneration;cancelInlinePings();inlinePings.clear();publicPingTasks=null;pingTaskPromise=null;transport?.stop();clearInterval(demoTimer);state.loading=true;state.error=null;state.snapshot=null;state.samples.clear();state.connection=isDemo?'demo':'connecting';state.paused=false;scheduleRender();
  if(isDemo){state.nodes=normalizeNodes(demoNodes);state.me={logged_in:false};state.loading=false;for(let t=-25;t<0;t++){const s=normalizeSnapshot(demoSnapshot(t));for(const n of state.nodes){const r=s.reports[n.uuid];if(s.online.has(n.uuid)){const samples=state.samples.get(n.uuid)||[];samples.push({time:Date.now()+t*2000,value:r.cpu.usage});state.samples.set(n.uuid,samples);}}}onSnapshot(normalizeSnapshot(demoSnapshot(0)));demoTimer=setInterval(()=>{if(!state.paused&&!document.hidden){state.tick++;onSnapshot(normalizeSnapshot(demoSnapshot(state.tick)));}},2000);}
  else{
    const results=await Promise.allSettled([getNodes(),apiGet('/api/public'),apiGet('/api/me')]);if(generation!==initGeneration)return;
    if(results[1].status==='fulfilled'){state.settings=results[1].value;applyAdminSettings();}
    if(results[2].status==='fulfilled')state.me=results[2].value;
    if(results[0].status==='rejected'){state.error=results[0].reason;state.nodes=[];state.connection='error';state.loading=false;scheduleRender();return;}
    state.nodes=results[0].value;state.loading=false;
    transport=new KomariTransport({onSnapshot,onConnection:c=>{state.connection=c;scheduleRender();}});transport.start();
  }
  scheduleRender();
  if(state.tab==='network'){state.network.uuid=state.nodes.some(n=>n.uuid===state.network.uuid)?state.network.uuid:state.nodes[0]?.uuid||'';loadNetwork();}
  const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('node'))openDetail(hash.get('node'));
}
function applyAdminSettings(){
  const s=state.settings, t=s.theme_settings||{};
  if(t.headline)$('site-title').textContent=String(t.headline);
  else if(s.sitename&&s.sitename!=='Komari')$('site-title').textContent=s.sitename;
  if(t.subtitle)$('site-description').textContent=String(t.subtitle);
  if(!Object.keys(storedPreferences||{}).length){if(WALLPAPERS.some(w=>w.id===t.default_wallpaper))prefs.wallpaper=t.default_wallpaper;if(numeric(t.background_dim)!==null)prefs.dim=clamp(Number(t.background_dim),20,95);if(typeof t.show_mascot==='boolean')prefs.mascot=t.show_mascot;applyPreferences();renderWallpapers();renderSettings();}
  for(const [admin,key,min,max] of [['panel_opacity','panelOpacity',10,100],['glass_blur','glassBlur',0,40],['border_strength','borderStrength',0,100]])if(!(key in storedPreferences)&&numeric(t[admin])!==null)prefs[key]=clamp(Number(t[admin]),min,max);
  for(const [admin,key] of [['glass_enabled','glass'],['show_globe','showGlobe'],['show_inline_ping','showPing'],['music_visuals','rhythm']])if(!(key in storedPreferences)&&typeof t[admin]==='boolean')prefs[key]=t[admin];
  if(!('mascotId' in storedPreferences)&&MASCOTS.some(m=>m.id===t.default_mascot))prefs.mascotId=t.default_mascot;
  if(!('globeQuality' in storedPreferences)&&['auto','high','eco'].includes(t.globe_quality))prefs.globeQuality=t.globe_quality;
  if(!('globeGlow' in storedPreferences)&&numeric(t.globe_glow)!==null)prefs.globeGlow=clamp(Number(t.globe_glow),0,100);
  if(!nodeSizeChosen&&NODE_SIZES.some(s=>s.id===t.default_node_size)){prefs.nodeSize=t.default_node_size;prefs.compact=['mini','compact'].includes(prefs.nodeSize);}
  if(!prefs.destinationTouched){
    if(CHINA_TARGETS[t.default_destination])prefs.chinaTarget=t.default_destination;
    else if(t.default_destination==='custom'){
      const custom=window.MikuDestinations.customTarget({name:t.destination_name,lat:t.destination_lat,lng:t.destination_lng});
      if(custom){prefs.customTarget=custom;prefs.chinaTarget='custom';}else prefs.chinaTarget='china';
    }
    syncDestinationEditor(true);
  }
  applyPreferences();renderSettings();
  $('oauth-link').hidden=!s.oauth_enable&&!s.oauth_enabled;
  if(s.disable_password_login){$('login-form').hidden=true;}else{$('login-form').hidden=false;}
}

function handleClick(event){
  const b=event.target.closest('button, a');if(!b)return;
  if(b.dataset.dialog){if(b.dataset.dialog==='wallpaper-dialog')renderWallpapers();if(b.dataset.dialog==='settings-dialog')renderSettings();showDialog(b.dataset.dialog);return;}
  if(b.dataset.close){$(b.dataset.close).close();return;}
  if(b.dataset.globeServer){if(!globe?.focusServer(b.dataset.globeServer))toast('服务器位置信息不可用。');return;}
  if(b.dataset.globeRename){openGlobeLabelEditor(b.dataset.globeRename);return;}
  if(b.dataset.detail){if($('globe-group-dialog').open)$('globe-group-dialog').close();openDetail(b.dataset.detail);return;}
  if(b.dataset.pingDetail){openDetail(b.dataset.pingDetail,'ping');return;}
  if(b.dataset.loadPing){queueInlinePing(b.dataset.loadPing,true);pumpInlinePings();return;}
  if(b.dataset.favorite){const id=b.dataset.favorite;state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);if(!safeWrite('miku39.favorites.v1',[...state.favorites]))toast('收藏已更新，本次浏览器无法保存。');scheduleRender();if($('detail-dialog').open)renderDetail();return;}
  if(b.dataset.tab){switchTab(b.dataset.tab);return;}
  if(b.dataset.group){state.group=b.dataset.group;scheduleRender();return;}
  if(b.dataset.view){state.view=b.dataset.view;prefs.view=state.view;persistPreferences();scheduleRender();return;}
  if(b.dataset.nodeSize){setNodeSize(b.dataset.nodeSize);return;}
  if(b.dataset.wallpaper){useBuiltinWallpaper(b.dataset.wallpaper);return;}
  if(b.dataset.mascotId){prefs.mascotId=b.dataset.mascotId;applyPreferences();persistPreferences();renderSettings();toast('伙伴已切换');return;}
  if(b.dataset.glassPreset){const presets={clear:{glass:true,panelOpacity:35,glassBlur:14,borderStrength:28},frost:{glass:true,panelOpacity:64,glassBlur:24,borderStrength:32},solid:{glass:false,panelOpacity:95,glassBlur:0,borderStrength:20}};if(!presets[b.dataset.glassPreset])return;Object.assign(prefs,presets[b.dataset.glassPreset]);applyPreferences();persistPreferences();renderSettings();return;}
  if(b.dataset.pref){const key=b.dataset.pref;prefs[key]=!prefs[key];if(key==='showPing'&&!prefs.showPing)cancelInlinePings();if(key==='rhythm'){if($('detail-dialog').open)renderDetail();if(state.tab==='network')renderNetwork();}b.setAttribute('aria-checked',prefs[key]);applyPreferences();persistPreferences();scheduleRender();return;}
  if(b.dataset.appearance){appearance=b.dataset.appearance;try{localStorage.setItem('appearance',appearance);}catch{}applyPreferences();renderSettings();return;}
  if(b.dataset.detailTab){const tabName=b.dataset.detailTab,oldTab=state.detail.tab;state.detail.tab=tabName;if(tabName==='ping'||oldTab==='ping')loadDetail();else renderDetail();document.querySelector(`[data-detail-tab="${tabName}"]`)?.focus({preventScroll:true});return;}
  if(b.dataset.pingTask){state.network.task=b.dataset.pingTask;renderNetwork();return;}
  if(b.id==='admin-link'&&!state.me.logged_in){event.preventDefault();if(isDemo)toast('演示模式不连接登录服务，安装主题后可正常登录。');else showDialog('login-dialog');return;}
  switch(b.dataset.action){
    case'appearance':appearance=document.documentElement.dataset.appearance==='dark'?'light':'dark';try{localStorage.setItem('appearance',appearance);}catch{}applyPreferences();renderSettings();break;
    case'refresh':if(state.paused){state.paused=false;transport?.setPaused(false);}if(isDemo){state.connection='demo';onSnapshot(normalizeSnapshot(demoSnapshot(++state.tick)));toast('演示数据已更新');}else if(transport?.ws?.readyState===1&&!state.error){transport.request();toast('正在刷新');}else initialize();break;
    case'pause':state.paused=!state.paused;if(state.paused)cancelInlinePings();if(isDemo)state.connection=state.paused?'paused':'demo';else transport?.setPaused(state.paused);scheduleRender();break;
    case'login':showDialog('login-dialog');break;
    case'reset-filters':state.search='';state.group='all';state.filter='all';$('search-input').value='';$('status-select').value='all';if(state.tab==='favorites')switchTab('nodes');scheduleRender();break;
    case'use-saved-wallpaper':useSavedWallpaper();break;
    case'restore-background':cancelBackgroundChange();Object.assign(prefs,{wallpaper:'daydream',backgroundSource:'builtin',dim:60,blur:3,rotate:false});applyPreferences();renderWallpapers();if(persistPreferences())toast('背景已恢复默认');break;
    case'restore-settings':cancelBackgroundChange();Object.assign(prefs,DEFAULT_PREFS,{customTarget:{...DEFAULT_PREFS.customTarget}});if($('wallpaper-url'))$('wallpaper-url').value='';nodeSizeChosen=true;syncDestinationEditor(true);appearance='dark';state.view='grid';try{localStorage.setItem('appearance',appearance);}catch{}applyPreferences();persistPreferences();renderSettings();renderWallpapers();scheduleRender();toast('外观设置已恢复');break;
    case'restore-globe-label':saveGlobeLabel(true);break;
    case'retry-detail':loadDetail();break;
    case'refresh-network':loadNetwork();break;
    case'next-mascot':prefs.mascotId=MASCOTS[(MASCOTS.findIndex(m=>m.id===prefs.mascotId)+1)%MASCOTS.length].id;applyPreferences();persistPreferences();break;
    case'globe-rotate':prefs.globeRotate=!prefs.globeRotate;applyPreferences();persistPreferences();break;
    case'globe-reset':globe?.reset();break;
    case'globe-focus':globe?.focusTarget();break;
    case'globe-zoom-in':globe?.zoomBy(.1);break;
    case'globe-zoom-out':globe?.zoomBy(-.1);break;
    case'mascot':toast(state.connection==='live'||state.connection==='demo'?'今日也要保持连接呀 ♪':'别着急，等下一份心跳抵达 ♪');break;
  }
}
function handleChange(e){
  const t=e.target;
  if(t.id==='wallpaper-file'){const file=t.files?.[0];t.value='';if(file)selectCustomWallpaper('local',file);return;}
  if(t.id==='china-target'&&(CHINA_TARGETS[t.value]||t.value==='custom')){prefs.chinaTarget=t.value;prefs.destinationTouched=true;persistPreferences();syncDestinationEditor(true);syncGlobe();globe?.focusTarget();}
  if(t.id==='globe-quality'&&['auto','high','eco'].includes(t.value)){prefs.globeQuality=t.value;persistPreferences();syncGlobe();}
  if(t.id==='status-select'){state.filter=t.value;scheduleRender();}
  if(t.id==='sort-select'){state.sort=t.value;scheduleRender();}
  if(t.id==='detail-hours'){state.detail.hours=Number(t.value);loadDetail();}
  if(t.id==='network-node'){state.network.uuid=t.value;state.network.task='all';loadNetwork();}
  if(t.id==='network-hours'){state.network.hours=Number(t.value);loadNetwork();}
}
function handleInput(e){
  if(e.target.dataset.rangePref){const key=e.target.dataset.rangePref;if(!['panelOpacity','glassBlur','borderStrength','globeGlow'].includes(key))return;prefs[key]=Number(e.target.value);$(key+'-output').textContent=prefs[key]+e.target.dataset.unit;applyPreferences();persistPreferences();}
  if(e.target.id==='search-input'){state.search=e.target.value;scheduleRender();}
  if(e.target.id==='dim-range'){prefs.dim=Number(e.target.value);$('dim-output').textContent=prefs.dim+'%';applyPreferences();persistPreferences();}
  if(e.target.id==='blur-range'){prefs.blur=Number(e.target.value);$('blur-output').textContent=prefs.blur+'px';applyPreferences();persistPreferences();}
}
function handleKeydown(e){
  if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();if(state.tab==='network')switchTab('nodes');$('search-input').focus();}
  const tab=e.target.closest('[role=tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){const tabs=[...tab.parentElement.querySelectorAll('[role=tab]')],i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;e.preventDefault();const nextTab=tabs[next];nextTab.click();const replacement=nextTab.dataset.detailTab?document.querySelector(`[data-detail-tab="${nextTab.dataset.detailTab}"]`):nextTab;replacement?.focus();}
}
async function login(event){
  event.preventDefault();if(isDemo){toast('演示模式不连接登录服务。');return;}
  const form=$('login-form'),button=$('login-submit'),formData=new FormData(form);button.disabled=true;button.textContent='正在登录…';$('login-error').hidden=true;
  try{await apiGet('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(formData))});form.reset();$('login-dialog').close();toast('登录成功，正在重新连接。');await initialize();}
  catch(e){$('login-error').textContent=e.message;$('login-error').hidden=false;}
  finally{button.disabled=false;button.textContent='登录并连接';}
}

document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelInlinePings();else scheduleRender();if(transport){if(document.hidden)transport.setPaused(true);else transport.setPaused(state.paused);}if(!document.hidden&&!state.paused&&isDemo){state.connection='demo';onSnapshot(normalizeSnapshot(demoSnapshot(++state.tick)));}});
window.addEventListener('online',()=>{if(!isDemo&&['error','reconnecting','stale'].includes(state.connection))initialize();});
window.addEventListener('offline',()=>{if(!isDemo){transport?.stop();state.connection='stale';scheduleRender();}});
window.addEventListener('pagehide',()=>{cancelBackgroundChange();transport?.stop();clearInterval(demoTimer);clearInterval(rotationTimer);detailController?.abort();networkController?.abort();cancelInlinePings();globe?.destroy();globe=null;});
window.addEventListener('pageshow',e=>{if(e.persisted){applyPreferences();renderWallpapers();initialize();}});
// Refresh metadata without multiplying sockets; errors preserve the last valid list.
setInterval(async()=>{if(isDemo||document.hidden||state.error||state.paused)return;try{const nodes=await getNodes();state.nodes=nodes;if(state.group!=='all'&&!nodes.some(n=>n.group===state.group))state.group='all';scheduleRender();}catch{}},60000);
renderShell();initialize();restoreCustomBackground();

})();
