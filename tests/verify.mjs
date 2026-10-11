import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {MiniDocument} from './mini-dom.mjs';
import {backgroundBrowser,imageFile} from './background-fixture.mjs';
process.env.TZ='UTC'; // Date assertions are independent of the host timezone.
const root=path.resolve(import.meta.dirname,'..');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
const waitTick=()=>new Promise(r=>setTimeout(r,0));
function load(demo=false,fixture=null,storage={},browser={}){
 const els=new Map(),writes=[];
 const element=id=>{if(!els.has(id))els.set(id,{id,innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},classList:{add(){},remove(){},toggle(){}},attributes:{},listeners:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);},focus(){},close(){this.open=false;this.dispatchEvent({type:'close',target:this});},showModal(){this.open=true;},style:{setProperty(k,v){writes.push([k,v]);}}});return els.get(id);};
 class Clock extends Date {static now(){return Clock.time;} }Clock.time=Date.now();
 const document={documentElement:element('html'),getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},hidden:false};
 const window={MIKU39_DEMO:demo,MIKU39_ASSET_BASE:'/themes/miku39/dist/assets/',MikuDOM:{patchMarkup(el,markup){el.innerHTML=markup;}},addEventListener(){}};
 const context=vm.createContext({window,document,console,URL,URLSearchParams,Date:Clock,Math,JSON,Map,Set,Number,String,Intl,Array,Object,AbortController,DOMException,Promise,location:{search:'',hash:'',pathname:'/',origin:'https://example.test',protocol:'https:'},history:{replaceState(){}},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),localStorage:{getItem:k=>storage[k]??null,setItem(k,v){storage[k]=v;}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},setInterval:()=>0,clearInterval(){},setTimeout,clearTimeout,fetch:fixture||(()=>{throw Error('Unexpected network request');}),...browser});
 vm.runInContext(fs.readFileSync(root+'/dist/regions.js','utf8'),context);
 vm.runInContext(fs.readFileSync(root+'/dist/destinations.js','utf8'),context);
 vm.runInContext(fs.readFileSync(root+'/dist/music.js','utf8'),context);
 vm.runInContext(fs.readFileSync(root+'/dist/backgrounds.js','utf8'),context);
 const app=fs.readFileSync(root+'/dist/app.js','utf8').replace('renderShell();initialize();restoreCustomBackground();',`window.test={state,prefs,pingStats,getPing,fetchNodePing,renderInlinePing,renderPingDetail,renderCard,renderTable,applyPreferences,handleClick,handleInput,handleChange,queueInlinePing,pumpInlinePings,cancelInlinePings,inlinePings,pingJobs,flag,normalizeSnapshot,normalizeNodes,syncGlobe,getStatus,applyAdminSettings,renderDetail,recordSeries,lossSeries,getChinaTarget,destinationOptions,saveCustomDestination,renderNetwork,loadNetwork,loadDetail,render,getHistory,resourceSeries,trafficUsage,priceText,expiryTime,expiryDate,expiryText,parseTime,capacity,trafficMarkup,billingMarkup,openGlobeGroup,renderShell,parseGlobeLabel,normalizeGlobeLabels,globeLabels,globeName,openGlobeLabelEditor,saveGlobeLabel,background,currentWallpaper,selectCustomWallpaper,restoreCustomBackground,useBuiltinWallpaper,useSavedWallpaper,applyWallpaperURL,renderWallpapers};`);
 vm.runInContext(app,context);
 return {context,window,document,Clock,els,element,writes,api:window.test};
}
const demo=load(true),a=demo.api;
const node={uuid:'jp-1',name:'东京服务器',region:'日本',group:'亚太',tags:[],mem_total:8*1024**3,disk_total:80*1024**3,cpu_cores:4};
a.state.nodes=[node];a.state.connection='demo';a.state.snapshot={online:new Set(['jp-1']),reports:{'jp-1':{cpu:{usage:20},ram:{used:2,total:8},disk:{used:5,total:80},network:{up:1024**2,down:2048},uptime:90}}};
test('Normalize ISO, Chinese/English country names and flag emoji',()=>{for(const [input,code] of [['日本','JP'],['United States','US'],['🇭🇰','HK'],['DE','DE'],['chn','CN'],['中国香港','HK'],['United Kingdom','GB']])assert.equal(demo.window.MikuRegions.resolveCountry(input),code);assert.equal(demo.window.MikuRegions.resolveCountry('???'),'');});
test('Country icons are local SVG rather than emoji; unknown regions remain unknown',()=>{assert.match(a.flag(node),/flags\/jp.svg/);assert.match(a.flag('法国'),/flags\/fr.svg/);assert.match(a.flag('???'),/country-fallback/);assert.doesNotMatch(a.flag('???'),/flags\//);});
test('Use supplied coordinates; city/region fallback is identified',()=>{const r=demo.window.MikuRegions.nodeLocation(node);assert.equal(r.lat,35.6762);assert.match(r.source,/示意/);const exact=demo.window.MikuRegions.nodeLocation({...node,latitude:0,longitude:0});assert.equal(exact.lat,0);assert.equal(exact.lng,0);assert.equal(exact.source,'服务器坐标');assert.equal(demo.window.MikuRegions.nodeLocation({...node,region:'unknown'}),null);});
test('Ping statistics exclude failures from latency and include them in loss',()=>{const s=a.pingStats([{value:20},{value:40},{value:-1},{value:null},{value:'n/a'}]);assert.equal(s.average,30);assert.ok(Math.abs(s.loss-100/3)<1e-10);assert.equal(s.p95,40);assert.equal(s.count,3);const empty=a.pingStats([]);assert.equal(empty.average,null);assert.equal(empty.loss,null);});
a.inlinePings.set(node.uuid,{fetchedAt:demo.Clock.now(),loading:false,error:null,data:{tasks:[{id:'1',name:'中国 · 电信',interval:60},{id:2,name:'中国 · 联通'}],records:[{task_id:1,time:new Date(demo.Clock.now()-2000).toISOString(),value:0},{task_id:'1',time:new Date(demo.Clock.now()-1000).toISOString(),value:-1},{task_id:2,time:new Date(demo.Clock.now()).toISOString(),value:88}]}});
test('Cards render per-task latency, timeout, loss, mini charts and offline flags',()=>{const html=a.renderCard(node);assert.match(html,/延迟 \/ 丢包/);assert.match(html,/50.0%/);assert.match(html,/超时/);assert.match(html,/88 ms/);assert.match(html,/flags\/jp.svg/);assert.match(html,/日本 · JP/);assert.match(html,/data-ping-detail="jp-1"/);assert.equal((html.match(/class="ping-metric"/g)||[]).length,4);});
test('Table and detail use the same real records',()=>{assert.match(a.renderTable([node]),/延迟 \/ 丢包/);const detail=a.renderPingDetail(a.inlinePings.get(node.uuid).data,node,1);assert.match(detail,/0.0 ms/);assert.match(detail,/88.0 ms/);assert.match(detail,/50.00%/);assert.match(detail,/Agent|模拟/);});
test('Unconfigured, failed and stale sampling are explicit; no fabricated zero',()=>{a.inlinePings.set('empty',{data:{tasks:[],records:[]},fetchedAt:demo.Clock.now()});assert.match(a.renderInlinePing({...node,uuid:'empty'}),/暂无公开采样/);a.inlinePings.set('error',{error:'HTTP 403',loading:false,fetchedAt:demo.Clock.now()});assert.match(a.renderInlinePing({...node,uuid:'error'}),/采样读取失败/);a.state.connection='stale';assert.match(a.renderInlinePing(node),/待刷新/);assert.match(a.renderInlinePing(node),/当前服务器未确认在线/);a.state.connection='demo';});
test('Dynamic values are escaped in card, address and Ping labels',()=>{const evil={...node,name:'<img src=x onerror=alert(1)>',ipv4:'<script>x</script>',region:'US'};const html=a.renderCard(evil);assert.doesNotMatch(html,/<script>/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;script&gt;/);a.inlinePings.get(node.uuid).data.tasks[0].name='<svg onload=alert(1)>';assert.doesNotMatch(a.renderInlinePing(node),/<svg onload/);});
test('Glass sliders immediately update CSS and preserve visitor preferences',()=>{a.handleInput({target:{id:'panelOpacity-range',dataset:{rangePref:'panelOpacity',unit:'%'},value:'37'}});assert.equal(a.prefs.panelOpacity,37);assert.ok(demo.writes.some(([k,v])=>k==='--panel-opacity'&&v==='0.37'));a.handleInput({target:{id:'glassBlur-range',dataset:{rangePref:'glassBlur',unit:'px'},value:'32'}});assert.ok(demo.writes.some(([k,v])=>k==='--glass-blur'&&v==='32px'));});
test('Four companions switch without replacing the original asset',()=>{a.handleClick({target:{closest:()=>({dataset:{mascotId:'orbit'}})}});assert.equal(a.prefs.mascotId,'orbit');assert.match(demo.element('mascot-image').src,/miku-orbit.webp/);a.handleClick({target:{closest:()=>({dataset:{action:'next-mascot'}})}});assert.equal(a.prefs.mascotId,'song');});
test('Globe defaults to China and uses online positive uploads with region selection',()=>{let result,options;demo.window.MikuTrafficGlobe=class{setData(r,t){result={r,t};}setOptions(v){options=v;}focusTarget(){}};a.prefs.showGlobe=true;a.syncGlobe();assert.equal(result.r.length,1);assert.equal(result.r[0].speed,1024**2);assert.equal(result.t.name,'中国');assert.equal(result.t.label,'中国');a.handleChange({target:{id:'china-target',value:'beijing'}});assert.equal(result.t.name,'北京市');a.state.paused=true;a.state.connection='paused';a.syncGlobe();assert.equal(result.r.length,0);assert.equal(options.paused,true);a.state.paused=false;a.state.connection='demo';});
// Actual sphere mathematics, independent of browser rendering.
const geo=vm.createContext({window:{},Math,Date,matchMedia(){}});
vm.runInContext(fs.readFileSync(root+'/dist/earth-data.js','utf8'),geo);
vm.runInContext(fs.readFileSync(root+'/dist/earth-renderer.js','utf8'),geo);
vm.runInContext(fs.readFileSync(root+'/dist/globe.js','utf8').replace('window.MikuTrafficGlobe=TrafficGlobe;','window.MikuTrafficGlobe=TrafficGlobe;window.geometry={vector,arcPoints,coasts,sampleArc,visible};'),geo);
test('3D great-circle paths preserve endpoints, altitude and finite antipodal geometry',()=>{const {vector,arcPoints}=geo.window.geometry;const src={lat:35.6762,lng:139.6503},dst={lat:31.2304,lng:121.4737},points=arcPoints(src,dst),start=vector(src.lat,src.lng),end=vector(dst.lat,dst.lng);assert.equal(points.length,81);for(let j=0;j<3;j++){assert.ok(Math.abs(points[0][j]-start[j]*1.007)<1e-7);assert.ok(Math.abs(points[80][j]-end[j]*1.007)<1e-7);}assert.ok(Math.hypot(...points[40])>1.007);for(const p of arcPoints({lat:0,lng:0},{lat:0,lng:180})){assert.ok(p.every(Number.isFinite));assert.ok(Math.hypot(...p)>=1.006);}assert.ok(geo.window.geometry.coasts.flat().length>20000);});
test('Old preferences migrate to national China; invalid values are bounded',()=>{const old=load(true,null,{'miku39.preferences.v1':JSON.stringify({wallpaper:'bad',dim:200,glassBlur:-3,panelOpacity:1000,mascotId:'missing',chinaTarget:'shanghai',showGlobe:'no'})});assert.equal(old.api.prefs.wallpaper,'daydream');assert.equal(old.api.prefs.dim,95);assert.equal(old.api.prefs.glassBlur,0);assert.equal(old.api.prefs.panelOpacity,100);assert.equal(old.api.prefs.mascotId,'classic');assert.equal(old.api.prefs.chinaTarget,'china');assert.equal(old.api.prefs.showGlobe,true);});
let active=0,peak=0,calls=[];
const releases=[];
const response=(data,status=200)=>({ok:status===200,status,json:async()=>({status:status===200?'success':'error',data,message:status===200?'':'Sampling denied'})});
const live=load(false,(url,opts)=>{
 calls.push({url,credentials:opts.credentials});if(url==='/api/task/ping')return Promise.resolve(response([{id:7,name:'真实任务',clients:['n0','n1','n2','n3','n4','n5']} ]));
 active++;peak=Math.max(peak,active);const uuid=new URL(url,'https://test').searchParams.get('uuid');
 return new Promise((resolve,reject)=>{const finish=()=>{active--;resolve(uuid==='n1'?response({},403):response({tasks:[],records:[{client:uuid,task_id:7,time:new Date().toISOString(),value:30},{client:'wrong-node',task_id:7,time:new Date().toISOString(),value:9999}]}));};releases.push(finish);opts.signal.addEventListener('abort',()=>{active--;reject(new DOMException('aborted','AbortError'));},{once:true});});
});
for(let i=0;i<6;i++)live.api.queueInlinePing('n'+i,true);live.api.pumpInlinePings();
await waitTick();assert.equal(active,3);while(releases.length){releases.shift()();await waitTick();}
test('Bounded three-request concurrency survives one-node failure and filters foreign records',()=>{assert.equal(peak,3);assert.equal(live.api.inlinePings.get('n0').data.records.length,1);assert.match(live.api.inlinePings.get('n1').error,/Sampling denied/);assert.equal(live.api.inlinePings.get('n5').data.records[0].value,30);assert.equal(live.api.inlinePings.get('n0').data.tasks[0].name,'真实任务');assert.equal(calls.filter(c=>c.url==='/api/task/ping').length,1);assert.ok(calls.every(c=>c.credentials==='same-origin'));});
test('A render within the sampling TTL does not create another request',()=>{const before=calls.length;live.api.queueInlinePing('n0');live.api.pumpInlinePings();assert.equal(calls.length,before);});
live.Clock.time+=61000;live.api.queueInlinePing('n0');live.api.pumpInlinePings();await waitTick();assert.equal(active,1);live.api.cancelInlinePings();await waitTick();
test('Expired cache refreshes, and cancellation clears active/queued work',()=>{assert.equal(live.api.pingJobs.size,0);assert.equal(live.api.inlinePings.get('n0').loading,false);assert.equal(active,0);});
const noMetadata=load(false,async url=>url==='/api/task/ping'?response({},404):response({records:[{task_id:'91',time:new Date().toISOString(),value:25}]}));
const fallback=await noMetadata.api.fetchNodePing('old');
test('Older backend with missing task metadata retains measurements',()=>{assert.equal(fallback.records[0].value,25);assert.equal(fallback.tasks[0].name,'任务 91');});
const nullRecords=load(false,async()=>response({records:null,tasks:[]}));
const none=await nullRecords.api.getPing('new',1);
test('Null records are an empty state rather than an exception',()=>assert.equal(none.records.length,0));
test('Malformed timestamps keep latest latency unknown',()=>{const html=a.renderPingDetail({tasks:[{id:1,name:'无时间戳'}],records:[{task_id:1,value:20,time:'invalid'}]},node,1);assert.doesNotMatch(html,/undefined ms|NaN/);assert.match(html,/20.0 ms/);});
const meta=JSON.parse(fs.readFileSync(root+'/komari-theme.json'));
test('Theme version, script order and all local assets match installation contract',()=>{assert.equal(meta.version,'1.4.5');const index=fs.readFileSync(root+'/dist/index.html','utf8');assert.ok(index.indexOf('dom.js')<index.indexOf('app.js'));assert.ok(index.indexOf('destinations.js')<index.indexOf('app.js'));assert.ok(index.indexOf('regions.js')<index.indexOf('globe.js'));assert.ok(index.indexOf('globe.js')<index.indexOf('app.js'));for(const name of ['miku.webp','miku-leek.webp','miku-orbit.webp','miku-song.webp'])assert.ok(fs.statSync(root+'/dist/assets/'+name).size>10000);const count=fs.readdirSync(root+'/dist/assets/flags').filter(f=>f.endsWith('.svg')).length;assert.ok(count>=60);});

test('Display size migration preserves both old compact choices and unrelated preferences',()=>{
 const fresh=load(true);assert.equal(fresh.api.prefs.nodeSize,'compact');
 for(const [compact,size] of [[true,'compact'],[false,'standard']]){
  const visitor=load(true,null,{'miku39.preferences.v1':JSON.stringify({compact,wallpaper:'starlight',panelOpacity:37})});
  assert.equal(visitor.api.prefs.nodeSize,size);assert.equal(visitor.api.prefs.wallpaper,'starlight');assert.equal(visitor.api.prefs.panelOpacity,37);
 }
 for(const nodeSize of [null,'missing',{},['large']])assert.equal(load(true,null,{'miku39.preferences.v1':JSON.stringify({nodeSize})}).api.prefs.nodeSize,'compact');
 assert.equal(load(true,null,{'miku39.preferences.v1':JSON.stringify({compact:false,nodeSize:'large'})}).api.prefs.nodeSize,'large');
});
test('All four sizes apply immediately, persist across reload and reject unknown choices',()=>{
 const storage={},visitor=load(true,null,storage),v=visitor.api;
 v.handleClick({target:{closest:()=>({dataset:{dialog:'settings-dialog'}})}});
 const settings=visitor.element('settings-options').innerHTML;
 assert.equal((settings.match(/data-node-size=/g)||[]).length,4);assert.doesNotMatch(settings,/data-pref="compact"/);
 for(const size of ['mini','compact','standard','large']){
  v.handleClick({target:{closest:()=>({dataset:{nodeSize:size}})}});
  assert.equal(visitor.document.documentElement.dataset.nodeSize,size);assert.equal(v.prefs.nodeSize,size);
  assert.equal(JSON.parse(storage['miku39.preferences.v1']).nodeSize,size);assert.equal(load(true,null,storage).api.prefs.nodeSize,size);
 }
 const before=storage['miku39.preferences.v1'];v.handleClick({target:{closest:()=>({dataset:{nodeSize:'missing'}})}});
 assert.equal(v.prefs.nodeSize,'large');assert.equal(storage['miku39.preferences.v1'],before);
});
test('Visitor size overrides managed defaults and restoring settings returns to compact',()=>{
 const visitor=load(true),v=visitor.api;v.state.settings={theme_settings:{default_node_size:'large'}};v.applyAdminSettings();
 assert.equal(v.prefs.nodeSize,'large');v.handleClick({target:{closest:()=>({dataset:{nodeSize:'mini'}})}});v.applyAdminSettings();assert.equal(v.prefs.nodeSize,'mini');
 v.handleClick({target:{closest:()=>({dataset:{action:'restore-settings'}})}});assert.equal(v.prefs.nodeSize,'compact');v.applyAdminSettings();assert.equal(v.prefs.nodeSize,'compact');
 const saved=load(true,null,{'miku39.preferences.v1':JSON.stringify({nodeSize:'standard'})});saved.api.state.settings=v.state.settings;saved.api.applyAdminSettings();assert.equal(saved.api.prefs.nodeSize,'standard');
 const legacy=load(true,null,{'miku39.preferences.v1':JSON.stringify({compact:true})});legacy.api.state.settings=v.state.settings;legacy.api.applyAdminSettings();assert.equal(legacy.api.prefs.nodeSize,'compact');
 const invalid=load(true);invalid.api.state.settings={theme_settings:{default_node_size:'missing'}};invalid.api.applyAdminSettings();assert.equal(invalid.api.prefs.nodeSize,'compact');
 assert.equal(meta.configuration.data.find(row=>row.key==='default_node_size').default,'compact');
});
test('Unavailable storage still applies size and size changes preserve monitoring markup',()=>{
 const visitor=load(true),v=visitor.api;v.state.nodes=[node];v.state.connection=a.state.connection;v.state.snapshot=a.state.snapshot;
 v.inlinePings.set(node.uuid,a.inlinePings.get(node.uuid));const before=v.renderCard(node),table=v.renderTable([node]);
 visitor.context.localStorage.setItem=()=>{throw Error('Storage disabled');};
 for(const size of ['mini','compact','standard','large']){
  v.handleClick({target:{closest:()=>({dataset:{nodeSize:size}})}});
  assert.equal(visitor.document.documentElement.dataset.nodeSize,size);assert.equal(v.renderCard(node),before);assert.equal(v.renderTable([node]),table);
 }
 assert.match(visitor.element('toast').textContent,/浏览器无法保存偏好/);
});

test('Nationwide plus 34 province-level options are unique and have finite coordinates',()=>{
 const destinations=demo.window.MikuDestinations;
 assert.equal(destinations.groups.flatMap(([,rows])=>rows).length,34);
 assert.equal(Object.keys(destinations.targets).length,35);
 for(const target of Object.values(destinations.targets))assert.ok(Number.isFinite(target.lat)&&Number.isFinite(target.lng));
 const options=a.destinationOptions();assert.equal((options.match(/<option /g)||[]).length,36);assert.match(options,/中国（全国）/);assert.match(options,/新疆维吾尔自治区/);assert.match(options,/澳门特别行政区/);assert.match(options,/自定义区域/);
});
test('Custom destinations validate empty, infinite and out-of-range coordinates and accept zero',()=>{
 const validate=demo.window.MikuDestinations.customTarget;
 for(const value of [{name:'x',lat:'',lng:10},{name:'x',lat:10,lng:null},{name:'x',lat:91,lng:120},{name:'x',lat:30,lng:181},{name:'x',lat:Infinity,lng:100},{name:' ',lat:30,lng:100}])assert.equal(validate(value),null);
 assert.equal(validate({name:'自定点',lat:0,lng:0}).lat,0);
 a.handleChange({target:{id:'china-target',value:'custom'}});
 demo.element('destination-name').value='华东汇聚';demo.element('destination-lat').value='31.2';demo.element('destination-lng').value='121.5';a.saveCustomDestination();
 assert.equal(a.getChinaTarget().label,'中国 · 华东汇聚');
 const previous=a.prefs.customTarget;demo.element('destination-lat').value='not-a-number';a.saveCustomDestination();assert.equal(a.prefs.customTarget,previous);assert.equal(demo.element('destination-error').hidden,false);
});
test('Saved explicit region and custom choices survive reload; malformed storage falls back safely',()=>{
 const storage={'miku39.preferences.v1':JSON.stringify({wallpaper:'starlight',destinationVersion:2,destinationTouched:true,chinaTarget:'custom',customTarget:{name:'汇聚站',lat:30,lng:120}})};
 const saved=load(true,null,storage);assert.equal(saved.api.getChinaTarget().name,'汇聚站');assert.equal(saved.api.prefs.wallpaper,'starlight');
 const bad=load(true,null,{'miku39.preferences.v1':JSON.stringify({destinationVersion:2,chinaTarget:'custom',customTarget:{name:'x',lat:999,lng:0}})});assert.equal(bad.api.prefs.chinaTarget,'china');
 const malformed=load(true,null,{'miku39.preferences.v1':'null'});assert.equal(malformed.api.prefs.chinaTarget,'china');malformed.api.applyAdminSettings();
});
test('Miku managed defaults apply once and visitor destination choices take precedence',()=>{
 const visitor=load(true);visitor.api.state.settings={theme_settings:{default_destination:'guangdong'}};visitor.api.applyAdminSettings();assert.equal(visitor.api.getChinaTarget().name,'广东省');
 visitor.api.handleChange({target:{id:'china-target',value:'xinjiang'}});visitor.api.applyAdminSettings();assert.equal(visitor.api.getChinaTarget().name,'新疆维吾尔自治区');
 const custom=load(true);custom.api.state.settings={theme_settings:{default_destination:'custom',destination_name:'机房入口',destination_lat:30,destination_lng:110}};custom.api.applyAdminSettings();assert.equal(custom.api.getChinaTarget().name,'机房入口');
 custom.api.state.settings.theme_settings.destination_lat=1000;custom.api.applyAdminSettings();assert.equal(custom.api.prefs.chinaTarget,'china');
 assert.equal(meta.configuration.name['zh-CN'],'Miku 主题设置');assert.ok(meta.configuration.data.filter(x=>x.type==='title').every(x=>x.name.startsWith('Miku ·')));
 assert.doesNotMatch(JSON.stringify(meta),/波奇|bocchi|bochi/i);
});
test('Rolling loss is per task, respects five-minute boundaries and preserves missing values',()=>{
 const start=Date.parse('2026-10-09T10:00:00Z');
 const records=[{time:new Date(start).toISOString(),value:-1},{time:new Date(start+60000).toISOString(),value:20},{time:new Date(start+120000).toISOString(),value:null},{time:new Date(start+301000).toISOString(),value:30},{time:new Date(start+700000).toISOString(),value:0}];
 const values=a.lossSeries(records).map(x=>x.value);assert.equal(values[0],100);assert.equal(values[1],50);assert.equal(values[2],null);assert.equal(values[3],0);assert.equal(values[4],0);
 assert.equal(a.lossSeries([{time:'invalid',value:-1}]).length,0);
 const markup=a.renderPingDetail(a.inlinePings.get(node.uuid).data,node,1);assert.equal((markup.match(/chart-loss/g)||[]).length,2);assert.equal((markup.match(/chart-latency/g)||[]).length,2);assert.match(markup,/5 分钟滚动/);
});
test('All failures show 100 percent loss; all missing measurements stay unknown',()=>{
 const failed={tasks:[{id:81,name:'全失败'}],records:[{task_id:81,time:new Date().toISOString(),value:-1}]};
 a.inlinePings.set('loss-only',{data:failed,fetchedAt:demo.Clock.now()});const markup=a.renderInlinePing({...node,uuid:'loss-only'});assert.match(markup,/100.0%/);assert.match(markup,/超时/);assert.match(markup,/全失败丢包率/);
 const missing=a.lossSeries([{time:new Date().toISOString(),value:null}]);assert.equal(missing[0].value,null);
 a.inlinePings.set('loss-missing',{data:{tasks:failed.tasks,records:[{task_id:81,time:new Date().toISOString(),value:null}]},fetchedAt:demo.Clock.now()});assert.doesNotMatch(a.renderInlinePing({...node,uuid:'loss-missing'}),/>0.0%/);
});
test('Network refreshes retain both curves until replacement records arrive',()=>{
 a.state.network={uuid:node.uuid,hours:1,task:'all',data:a.inlinePings.get(node.uuid).data,loading:true,error:null};a.renderNetwork();const markup=demo.element('network-panel').innerHTML;assert.match(markup,/保留当前曲线/);assert.match(markup,/chart-loss/);assert.match(markup,/chart-latency/);assert.doesNotMatch(markup,/class="skeleton"/);
 a.state.network.loading=false;a.state.network.error='Temporary failure';a.renderNetwork();assert.match(demo.element('network-panel').innerHTML,/保留上次采样/);assert.match(demo.element('network-panel').innerHTML,/chart-loss/);
});

// Execute the production reconciler against node identities and live attributes.
const domDocument=new MiniDocument(),domWindow={};
vm.runInNewContext(fs.readFileSync(root+'/dist/dom.js','utf8'),{window:domWindow});
const patch=domWindow.MikuDOM.patchMarkup;
const container=domDocument.createElement('div');
const descendants=root=>{const nodes=new Set([root]);const walk=n=>{for(const child of n.childNodes){nodes.add(child);walk(child);}};walk(root);return nodes;};
const liveMutations=before=>domDocument.mutations.filter(m=>before.has(m.node)||before.has(m.parent));
const markup=a.renderCard(node);patch(container,markup);
test('An identical live update produces no mutations on existing cards, images or SVGs',()=>{
 const original=container.firstChild,flag=container.querySelector('img'),svg=container.querySelector('svg'),before=descendants(container);domDocument.reset();patch(container,markup);
 assert.equal(container.firstChild,original);assert.equal(container.querySelector('img'),flag);assert.equal(container.querySelector('svg'),svg);assert.equal(liveMutations(before).length,0);
});
test('Continuous snapshots update metrics while retaining card, flag and Ping SVG identities',()=>{
 const card=container.firstChild,flag=container.querySelector('img'),ping=container.querySelector('[data-ping-task-id="1"]'),pingSVG=ping.querySelector('svg');
 for(let i=0;i<60;i++){
  a.state.snapshot.reports[node.uuid].cpu.usage=20+i%30;
  const before=descendants(container);domDocument.reset();patch(container,a.renderCard(node));
  assert.equal(container.firstChild,card);assert.equal(container.querySelector('img'),flag);assert.equal(container.querySelector('[data-ping-task-id="1"]'),ping);assert.equal(ping.querySelector('svg'),pingSVG);
  assert.ok(liveMutations(before).every(m=>m.kind==='text'||m.kind==='attribute'));
 }
 assert.match(container.textContent,/49.0%/);
});
test('Fresh Ping records change paths in place, and background refresh keeps both curves',()=>{
 const task=container.querySelector('[data-ping-task-id="1"]'),svgs=task.querySelectorAll('svg'),cache=a.inlinePings.get(node.uuid);
 cache.loading=true;patch(container,a.renderCard(node));assert.equal(container.querySelector('[data-ping-task-id="1"]'),task);assert.equal(task.querySelectorAll('svg')[1],svgs[1]);
 cache.data={...cache.data,records:[...cache.data.records,{task_id:1,time:new Date(demo.Clock.now()+1000).toISOString(),value:45}]};cache.loading=false;patch(container,a.renderCard(node));
 assert.equal(container.querySelector('[data-ping-task-id="1"]'),task);assert.equal(task.querySelectorAll('svg')[0],svgs[0]);assert.equal(task.querySelectorAll('svg')[1],svgs[1]);assert.match(task.textContent,/45 ms/);assert.match(task.textContent,/33.3%/);
});
test('Sorting and removal move or remove only the matching keyed node',()=>{
 const second={...node,uuid:'jp-2',name:'第二服务器'};patch(container,a.renderCard(node)+a.renderCard(second));
 const first=container.querySelector('[data-node="jp-1"]'),other=container.querySelector('[data-node="jp-2"]');
 patch(container,a.renderCard(second)+a.renderCard(node));assert.equal(container.firstChild,other);assert.equal(container.childNodes[1],first);
 patch(container,a.renderCard(second));assert.equal(container.firstChild,other);assert.equal(first.parentNode,null);assert.equal(container.childNodes.length,1);
});
test('Late CPU sparks and Ping toggles preserve existing footer and resource meters',()=>{
 patch(container,a.renderCard(node));const footer=container.querySelector('.node-bottom'),meter=container.querySelector('.meter');
 a.state.samples.set(node.uuid,[{time:demo.Clock.now()-1000,value:10},{time:demo.Clock.now(),value:20}]);patch(container,a.renderCard(node));assert.equal(container.querySelector('.node-bottom'),footer);assert.equal(container.querySelector('.meter'),meter);
 a.prefs.showPing=false;patch(container,a.renderCard(node));assert.equal(container.querySelector('.node-bottom'),footer);assert.equal(container.querySelector('.meter'),meter);assert.equal(container.querySelector('.inline-ping'),null);a.prefs.showPing=true;
});
test('Table rows retain their server identity when sorted and updated',()=>{
 const second={...node,uuid:'jp-2',name:'第二服务器'};patch(container,a.renderTable([node,second]));const row=container.querySelector('[data-node-row="jp-1"]'),flag=row.querySelector('img');patch(container,a.renderTable([second,node]));assert.equal(container.querySelector('[data-node-row="jp-1"]'),row);assert.equal(row.querySelector('img'),flag);
});
test('Reconciliation preserves focused-button identity, control values and the canvas surface',()=>{
 patch(container,'<button id="focus">Node</button><input id="range" value="64"><select id="sel"><option value="a" selected>A</option><option value="b">B</option></select><canvas id="world"></canvas>');
 const button=container.querySelector('#focus'),canvas=container.querySelector('canvas'),input=container.querySelector('input'),select=container.querySelector('select');canvas.buffer={drawn:true};
 patch(container,'<button id="focus">Node updated</button><input id="range" value="37"><select id="sel"><option value="a">A</option><option value="b" selected>B</option></select><canvas id="world"></canvas>');
 assert.equal(container.querySelector('#focus'),button);assert.equal(container.querySelector('canvas'),canvas);assert.equal(canvas.buffer.drawn,true);assert.equal(input.value,'37');assert.equal(select.value,'b');
});

const Globe=geo.window.MikuTrafficGlobe;
const globe=Object.create(Globe.prototype);Object.assign(globe,{routes:[],routeCache:new Map(),pulse:0,wake(){},options:{motion:true,rotate:false,quality:'auto'},velocity:{x:0,y:0},lastInteraction:0,yaw:1.8,pitch:.6,zoom:1,reduced:{matches:false},inView:true});
const routes=[{uuid:'a',lat:35,lng:139,speed:1024,country:'JP'},{uuid:'b',lat:40,lng:-74,speed:2048,country:'US'}],destination=demo.window.MikuDestinations.targets.china;
test('Rate changes and reordered nodes preserve globe paths and particle phases',()=>{
 globe.setData(routes,destination);const first=globe.routes[0],points=first.points;globe.advance(32);const phase=first.phase;
 globe.setData([{...routes[1],speed:9999},{...routes[0],speed:1024**3}],destination);assert.equal(globe.routes[1],first);assert.equal(first.points,points);assert.equal(first.phase,phase);
 globe.advance(32);assert.ok(first.phase!==phase);assert.ok((first.phase-phase+1)%1<.02);
 globe.setData([routes[0]],demo.window.MikuDestinations.targets.guangdong);assert.equal(globe.routes[0],first);assert.notEqual(first.points,points);assert.equal(globe.routeCache.size,1);
});
test('Canvas resize only clears the drawing buffer when pixel dimensions change',()=>{
 let width=600,height=335,sets=0;const canvas={getBoundingClientRect:()=>({width:300,height:167.5})};Object.defineProperties(canvas,{width:{get:()=>width,set:v=>{width=v;sets++;}},height:{get:()=>height,set:v=>{height=v;sets++;}}});geo.devicePixelRatio=2;globe.canvas=canvas;
 globe.resize();assert.equal(sets,0);globe.resize();assert.equal(sets,0);canvas.getBoundingClientRect=()=>({width:320,height:167.5});globe.resize();assert.equal(sets,1);assert.equal(width,640);
});
test('Paused or reduced-motion globe frames retain the current particle phase',()=>{
 geo.document={hidden:false};globe.ctx={};globe.draw=()=>{};globe.lastFrame=100;globe.options.paused=true;const phase=globe.routes[0].phase;globe.frame(140);assert.equal(globe.routes[0].phase,phase);
 globe.options.paused=false;globe.reduced.matches=true;globe.frame(180);assert.equal(globe.routes[0].phase,phase);
});
test('Musical time buckets use real peaks, count breaks and leave empty intervals',()=>{
 const series=[{time:0,value:0},{time:10,value:20},{time:12,value:-1},{time:14,value:null},{time:1000,value:55}];
 const columns=demo.window.MikuMusic.bins(series,5);assert.equal(columns.length,5);assert.equal(columns[0].value,20);assert.equal(columns[0].failed,1);assert.equal(columns[0].missing,1);assert.equal(columns[1].value,null);assert.equal(columns[1].count,0);assert.equal(columns.at(-1).value,55);assert.equal(series[0].value,0);
 assert.equal(demo.window.MikuMusic.bins(series,5),columns);
});
test('Rhythm SVG shows real failures, unknowns and escaped labels without synthetic bars',()=>{
 const mini=demo.window.MikuMusic.mini;
 assert.match(mini([{time:0,value:-1}],{escape:value=>String(value).replaceAll('<','&lt;')}),/rhythm-break/);
 assert.doesNotMatch(mini([{time:0,value:-1}]),/<rect/);
 assert.doesNotMatch(mini([{time:0,value:null}]),/<rect/);
 const output=mini([{time:0,value:0},{time:1,value:10}],{label:'<img onerror=x>',escape:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')});assert.doesNotMatch(output,/<img/);assert.match(output,/区间峰值 10.0/);assert.equal((output.match(/<rect/g)||[]).length,2);
});
test('Loss-track break marks correspond to failed samples, independently of rolling loss',()=>{
 const points=a.lossSeries([{time:'2026-10-09T00:00:00Z',value:-1},{time:'2026-10-09T00:01:00Z',value:20}]);assert.equal(points[0].failed,true);assert.equal(points[1].failed,false);assert.equal(points[1].value,50);const columns=demo.window.MikuMusic.bins(points);assert.equal(columns.reduce((s,b)=>s+b.failed,0),1);
});
test('Turning rhythm off preserves numeric statistics and reuses ordinary charts',()=>{
 const before=a.pingStats(a.inlinePings.get(node.uuid).data.records);assert.match(a.renderCard(node),/rhythm-sample/);
 a.handleClick({target:{closest:()=>({dataset:{pref:'rhythm'},setAttribute(){}})}});assert.equal(a.prefs.rhythm,false);assert.doesNotMatch(a.renderCard(node),/rhythm-sample/);assert.match(a.renderCard(node),/mini-chart/);assert.deepEqual(a.pingStats(a.inlinePings.get(node.uuid).data.records),before);
 a.handleClick({target:{closest:()=>({dataset:{pref:'rhythm'},setAttribute(){}})}});assert.equal(a.prefs.rhythm,true);
});
test('Musical bars and playhead retain their elements across identical live updates',()=>{
 patch(container,a.renderCard(node));const sample=container.querySelector('[data-rhythm-sample]'),svg=sample.querySelector('svg'),playhead=sample.querySelector('.rhythm-playhead'),before=descendants(container);domDocument.reset();patch(container,a.renderCard(node));assert.equal(container.querySelector('[data-rhythm-sample]'),sample);assert.equal(sample.querySelector('svg'),svg);assert.equal(sample.querySelector('.rhythm-playhead'),playhead);assert.equal(liveMutations(before).length,0);
});
test('Globe quality and glow controls persist, with zero glow respected',()=>{
 const visitor=load(true);let options,focus=0;visitor.window.MikuTrafficGlobe=class{setData(){}setOptions(o){options=o;}focusTarget(){focus++;}};visitor.api.handleChange({target:{id:'globe-quality',value:'eco'}});assert.equal(visitor.api.prefs.globeQuality,'eco');assert.equal(options.quality,'eco');visitor.api.handleInput({target:{dataset:{rangePref:'globeGlow',unit:'%'},value:'0'}});assert.equal(options.glow,0);visitor.api.handleChange({target:{id:'china-target',value:'guangdong'}});assert.equal(focus,1);
});
test('Texture coordinates agree with globe projection in both hemispheres and at the seam',()=>{
 const {inverseNormal,atlasUV}=geo.window.MikuEarthRenderer;
 for(const [lat,lng] of [[35.8617,104.1954],[-33,151],[50,-100],[0,179.9],[0,-179.9],[89,20]]){
  const normal=inverseNormal(0,0,1,lng*Math.PI/180,lat*Math.PI/180),expected=geo.window.geometry.vector(lat,lng);for(let i=0;i<3;i++)assert.ok(Math.abs(normal[i]-expected[i])<1e-10);
  const [u,v]=atlasUV(...normal);assert.ok(Math.abs(u-(lng+180)/360)<1e-9);assert.ok(Math.abs(v-(90-lat)/180)<1e-9);
 }
});
test('Comets interpolate continuously between path vertices and opaque globe hides back routes',()=>{
 const {sampleArc,arcPoints,visible}=geo.window.geometry,points=arcPoints({lat:0,lng:0},{lat:40,lng:120});const a=sampleArc(points,.4999),b=sampleArc(points,.5001);assert.ok(Math.hypot(...a.map((n,i)=>n-b[i]))<.001);assert.deepEqual(sampleArc(points,0),points[0]);assert.deepEqual(sampleArc(points,1),points.at(-1));assert.equal(visible({x:0,y:0,z:-1},0,0,100),false);assert.equal(visible({x:120,y:0,z:-1},0,0,100),true);
});
test('Focus uses the shortest rotation and centers the selected destination',()=>{
 const focused=Object.create(Globe.prototype);Object.assign(focused,{target:{lat:31,lng:121},yaw:6.1,pitch:0,options:{motion:false},reduced:{matches:false},wake(){},cx:100,cy:100,radius:80});focused.focusTarget();assert.ok(Math.abs(focused.yaw-6.1)<=Math.PI);const projected=focused.project(geo.window.geometry.vector(31,121));assert.ok(Math.hypot(projected.x-100,projected.y-100)<1e-9);assert.equal(focused.focusAnimation,null);
});
test('Source coastlines and all offline dependencies precede the application',()=>{
 const index=fs.readFileSync(root+'/dist/index.html','utf8');for(const name of ['earth-data.js','earth-renderer.js','music.js'])assert.ok(index.indexOf(name)<index.indexOf('app.js'));assert.ok(index.indexOf('earth-renderer.js')<index.indexOf('globe.js'));assert.ok(fs.statSync(root+'/dist/assets/earth-atlas.webp').size>100000);assert.equal(geo.window.MikuEarth.coasts.length,1422);assert.ok(geo.window.MikuEarth.coasts.every(ring=>ring.every(point=>point.every(Number.isFinite))));
});
test('GPU program uploads a local atlas, preserves buffers and recovers context loss',()=>{
 const calls=[],listeners=new Map();let id=0;const gl={};for(const name of ['FRAGMENT_SHADER','VERTEX_SHADER','HIGH_FLOAT','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','TEXTURE_2D','RGB','UNSIGNED_BYTE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','REPEAT','LINEAR_MIPMAP_LINEAR','UNPACK_FLIP_Y_WEBGL','COLOR_BUFFER_BIT','FLOAT','TEXTURE0','TRIANGLES'])gl[name]=name;
 for(const name of ['createShader','createProgram','createBuffer','createTexture'])gl[name]=()=>({id:id++});
 for(const name of ['shaderSource','compileShader','deleteShader','attachShader','linkProgram','bindBuffer','bufferData','bindTexture','texImage2D','texParameteri','pixelStorei','generateMipmap','viewport','clearColor','clear','useProgram','enableVertexAttribArray','vertexAttribPointer','activeTexture','uniform1i','uniform2f','uniform1f','drawArrays','deleteTexture','deleteBuffer','deleteProgram'])gl[name]=(...args)=>{calls.push({name,args});if(name==='uniform1f')assert.ok(Number.isFinite(args[1]));};
 gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getShaderPrecisionFormat=()=>({precision:23});gl.getUniformLocation=(_,name)=>name;gl.getAttribLocation=()=>0;
 let width=0,height=0,resizes=0;const canvas={getContext:()=>gl,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};Object.defineProperties(canvas,{width:{get:()=>width,set:value=>{width=value;resizes++;}},height:{get:()=>height,set:value=>{height=value;resizes++;}}});
 let lost=0,restored=0;const renderer=new geo.window.MikuEarthRenderer.WebGLSphere(canvas,()=>lost++,()=>restored++),image={width:2048,height:1024};renderer.setAtlas(image);renderer.resize(600,440);renderer.resize(600,440);assert.equal(resizes,2);
 const scene={width:600,height:440,cx:300,cy:200,radius:160,dpr:1,yaw:1.8,pitch:.6,light:false,glow:1};assert.equal(renderer.draw(scene),true);assert.ok(calls.some(call=>call.name==='pixelStorei'&&call.args[1]===false));assert.ok(calls.some(call=>call.name==='generateMipmap'));
 let prevented=false;listeners.get('webglcontextlost')({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(lost,1);assert.equal(renderer.draw(scene),false);listeners.get('webglcontextrestored')();assert.equal(restored,1);assert.equal(renderer.draw(scene),true);renderer.destroy();assert.equal(listeners.size,0);assert.equal(calls.filter(call=>/^delete(Texture|Program|Buffer)$/.test(call.name)).length,3);
});
test('Compatible sphere caches pixels on unchanged poses and redraws with rotation',()=>{
 let reads=0,writes=0,draws=0;const ctx={drawImage(){draws++;},getImageData(){reads++;return {data:new Uint8ClampedArray([255,0,0,255,0,0,0,255,255,0,0,255,0,0,0,255])};},createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(){writes++;}};
 const original=geo.document;geo.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};const renderer=new geo.window.MikuEarthRenderer.CanvasSphere({width:2,height:2}),scene={radius:100,cx:100,cy:100,yaw:1,pitch:.5,light:false};renderer.draw(ctx,scene);renderer.draw(ctx,scene);assert.equal(reads,1);assert.equal(writes,1);renderer.draw(ctx,{...scene,yaw:1.2});assert.equal(writes,2);assert.equal(draws,4);geo.document=original;
});
test('Polar custom destinations stay centered when the globe is idle',()=>{
 const focused=Object.create(Globe.prototype);Object.assign(focused,{target:{lat:90,lng:100},yaw:0,pitch:0,options:{motion:true,rotate:false,paused:false},reduced:{matches:false},routes:[],velocity:{x:0,y:0},wake(){},draw(){},inView:true,ctx:{},pulse:0,lastFrame:100});focused.focusTarget(true);focused.frame(180);assert.equal(focused.pitch,Math.PI/2);
});
test('Zero and missing historical totals fall back to real server capacity, while recorded capacity wins',()=>{
 const records=[{time:'2026-10-09T10:00:00Z',ram:2*1024**3,ram_total:0,disk:20*1024**3,disk_total:0},{time:'2026-10-09T10:01:00Z',ram:4*1024**3,disk:0},{time:'2026-10-09T10:02:00Z',ram:2*1024**3,ram_total:4*1024**3,disk:40*1024**3,disk_total:160*1024**3}];
 assert.deepEqual(Array.from(a.resourceSeries(records,'ram',node,null),point=>point.value),[25,50,50]);
 assert.deepEqual(Array.from(a.resourceSeries(records,'disk',node,null),point=>point.value),[25,0,25]);
 const fallback={...node,mem_total:0,disk_total:null},report={ram:{total:8*1024**3},disk:{total:80*1024**3}};
 assert.equal(a.resourceSeries(records,'ram',fallback,report)[0].value,25);assert.equal(a.resourceSeries(records,'disk',fallback,report)[0].value,25);
 assert.equal(a.resourceSeries(records,'ram',fallback,null)[0].value,null);
 assert.equal(a.resourceSeries([{time:records[0].time,ram:null,ram_total:8*1024**3}],'ram',node,report)[0].value,null);
 assert.equal(a.resourceSeries([{time:records[0].time,ram:-1,ram_total:8*1024**3}],'ram',node,report)[0].value,null);
});
const storedHistory=[{client:node.uuid,time:'2026-10-09T10:00:00Z',cpu:.5,ram:306*1024**2,ram_total:0,disk:5*1024**3,disk_total:0,load:.12,net_in:1024,net_out:2048}];
const historyLive=load(false,async url=>{assert.match(url,/\/api\/records\/load\?/);return response({records:storedHistory,count:1});});
historyLive.api.state.nodes=[node];historyLive.api.state.connection='live';historyLive.api.state.snapshot={online:new Set([node.uuid]),reports:{[node.uuid]:{ram:{used:306*1024**2,total:8*1024**3},disk:{used:5*1024**3,total:80*1024**3},cpu:{usage:.5},network:{totalUp:10*1024**3,totalDown:20*1024**3}}}};
historyLive.api.state.detail={uuid:node.uuid,tab:'overview',hours:1,records:[],loading:false,error:null};await historyLive.api.loadDetail();
test('Public history API with zero totals produces memory and disk SVG charts rather than empty states',()=>{
 const markup=historyLive.element('detail-content').innerHTML;assert.doesNotMatch(markup,/暂无内存使用率记录|暂无磁盘使用率记录/);assert.match(markup,/aria-label="内存使用率，1个采样/);assert.match(markup,/aria-label="磁盘使用率，1个采样/);assert.match(markup,/服务器价格/);assert.match(markup,/到期时间/);assert.match(markup,/服务器流量/);
});
test('Traffic is available without a quota, and directional billing does not require the unused counter',()=>{
 const report={network:{totalUp:2*1024**3,totalDown:3*1024**3}};
 for(const [mode,value] of [['sum',5],['max',3],['min',2],['up',2],['down',3]])assert.equal(a.trafficUsage({...node,traffic_limit:0,traffic_limit_type:mode},report),value*1024**3);
 assert.equal(a.trafficUsage({...node,traffic_limit_type:'up'},{network:{totalUp:0}}),0);assert.equal(a.trafficUsage({...node,traffic_limit_type:'down'},{network:{totalDown:1024}}),1024);
 assert.equal(a.trafficUsage({...node,traffic_limit_type:'sum'},{network:{totalUp:1024}}),null);assert.equal(a.trafficUsage(node,{network:{totalUp:-1,totalDown:2}}),null);
 const markup=a.trafficMarkup({...node,traffic_limit:0,traffic_limit_type:'sum'},report,'offline');assert.match(markup,/5.00 GiB/);assert.match(markup,/未设流量配额/);assert.match(markup,/历史累计/);
 assert.match(a.trafficMarkup({...node,traffic_limit:1024**3,traffic_limit_type:'sum'},report),/已超出 4.00 GiB/);
});
test('Price and expiry distinguish unset, free, valid dates and SQL-style timestamps',()=>{
 assert.equal(a.priceText({...node,price:-1}),'免费');assert.equal(a.priceText({...node,price:0}),'未设置');assert.equal(a.priceText({...node,price:null}),'未设置');assert.equal(a.priceText({...node,price:12,currency:'USD',billing_cycle:30}),'USD 12 / 30天');
 assert.match(a.priceText({...node,price:7.25}),/周期未设置.*币种未设置/);
 assert.equal(a.expiryTime('0001-01-01T00:00:00Z'),null);assert.equal(a.expiryDate('invalid'),'未设置');
 assert.equal(a.expiryTime('2027-04-13 00:00:00.0000000+00:00'),Date.parse('2027-04-13T00:00:00.000Z'));
 assert.match(a.expiryText(new Date(demo.Clock.now()-60000).toISOString()),/^已到期$/);assert.match(a.expiryText(new Date(demo.Clock.now()+60000).toISOString()),/24 小时内/);
 assert.equal(a.parseTime('2026-10-09 10:00:00.1234567+08:00'),Date.parse('2026-10-09T02:00:00.123Z'));
});
test('Cards and tables always expose traffic, price and expiry, including missing metadata',()=>{
 const configured={...node,price:12,currency:'USD',billing_cycle:30,expired_at:'2027-04-13T00:00:00Z',traffic_limit:100*1024**3};
 for(const markup of [a.renderCard(configured),a.renderTable([configured])]){assert.match(markup,/流量/);assert.match(markup,/服务器价格/);assert.match(markup,/到期时间/);assert.match(markup,/USD 12 \/ 30天/);assert.match(markup,/2027\/04\/13/);}
 const empty=load(true);empty.api.state.nodes=[node];const markup=empty.api.renderCard(node);assert.match(markup,/未设置/);assert.match(markup,/服务器流量/);assert.doesNotMatch(markup,/NaN|undefined|Infinity/);
});
test('All server locations reach the globe while only online positive uploads create trails',()=>{
 const visitor=load(true);let payload,focused;
 visitor.window.MikuTrafficGlobe=class{setData(routes,target,servers){payload={routes,target,servers};}setOptions(){}focusServer(uuid){focused=uuid;return true;}};
 visitor.api.state.nodes=[{...node,uuid:'busy'},{...node,uuid:'idle'},{...node,uuid:'offline'},{...node,uuid:'missing',name:'Unknown',region:'???'}];visitor.api.state.connection='demo';visitor.api.state.loading=false;
 visitor.api.state.snapshot={online:new Set(['busy','idle','missing']),reports:{busy:{network:{up:2048}},idle:{network:{up:0}},offline:{network:{up:999}},missing:{network:{up:1024}}}};
 visitor.api.syncGlobe();assert.equal(payload.servers.length,3);assert.equal(payload.routes.length,1);assert.equal(payload.routes[0].uuid,'busy');assert.equal(payload.servers.find(server=>server.uuid==='offline').status,'offline');assert.equal(visitor.element('globe-node-count').textContent,'3 / 4');assert.match(visitor.element('globe-routes').innerHTML,/data-globe-server="idle"/);assert.match(visitor.element('globe-routes').innerHTML,/data-globe-server="offline"/);assert.match(visitor.element('globe-routes').innerHTML,/1 台服务器缺少/);
 visitor.api.handleClick({target:{closest:()=>({dataset:{globeServer:'idle'}})}});assert.equal(focused,'idle');
 visitor.api.state.connection='stale';visitor.api.syncGlobe();assert.equal(payload.routes.length,0);assert.equal(payload.servers.length,3);assert.ok(payload.servers.every(server=>server.status==='unknown'));
});
test('Geographic markers retain zero-flow and offline servers and group identical coordinates without moving them',()=>{
 const scene=Object.create(Globe.prototype);Object.assign(scene,{routeCache:new Map(),pulse:0,wake(){},options:{motion:false},reduced:{matches:false},yaw:0,pitch:0});
 const servers=[{uuid:'one',name:'One',lat:35,lng:139,status:'online',speed:1024},{uuid:'two',name:'Two',lat:35,lng:139,status:'offline',speed:0},{uuid:'three',name:'Three',lat:40,lng:-74,status:'online',speed:0}];
 scene.setData([servers[0]],destination,servers);assert.equal(scene.markers.length,3);assert.equal(scene.markerGroups.length,2);assert.equal(scene.markerGroups.find(group=>group.members.length===2).members.length,2);
 const marker=scene.markerCache.get('one'),position=marker.position,path=scene.routes[0].points;scene.advance(32);const phase=scene.routes[0].phase;
 scene.setData([],destination,servers.map(server=>({...server,status:'unknown'})));assert.equal(scene.markers.length,3);assert.equal(scene.routes.length,0);assert.equal(scene.markerCache.get('one'),marker);assert.equal(marker.position,position);
 scene.setData([servers[0]],destination,servers);assert.equal(scene.routes[0].points,path);assert.equal(scene.routes[0].phase,phase);
 scene.setData([],destination,[servers[2]]);assert.equal(scene.markerCache.size,1);assert.equal(scene.routeCache.size,0);assert.equal(scene.markerGroups.length,1);
});
test('Position focusing centers the chosen server and marker picking rejects the far hemisphere',()=>{
 const scene=Object.create(Globe.prototype);Object.assign(scene,{routeCache:new Map(),pulse:0,wake(){},options:{motion:false},reduced:{matches:false},yaw:0,pitch:0,cx:150,cy:150,radius:100});
 const servers=[{uuid:'front',name:'Front',lat:0,lng:0,status:'offline',speed:0},{uuid:'back',name:'Back',lat:0,lng:180,status:'online',speed:0}];scene.setData([],destination,servers);
 assert.equal(scene.pick(150,150).uuid,'front');assert.equal(scene.focusServer('back',true),true);assert.equal(scene.selectedUUID,'back');assert.equal(scene.pick(150,150).uuid,'back');assert.equal(scene.focusServer('absent'),false);
 assert.ok(Math.abs(scene.yaw-Math.PI)<1e-10);assert.equal(scene.pitch,0);
});
test('Position labels and selectable groups escape server names',()=>{
 const visitor=load(true);visitor.api.state.nodes=[{...node,uuid:'a',name:'<img src=x onerror=alert(1)>'},{...node,uuid:'b'}];visitor.api.openGlobeGroup(['a','b']);const markup=visitor.element('globe-group-content').innerHTML;assert.match(markup,/此位置的 2 台服务器/);assert.match(markup,/data-detail="a"/);assert.doesNotMatch(markup,/<img src=x/);assert.equal(visitor.element('globe-group-dialog').open,true);
});
test('Custom names reach globe markers, trails, lists and groups without changing server data or making API writes',()=>{
 let requests=0,payload;const visitor=load(false,()=>{requests++;throw Error('Unexpected request');}),v=visitor.api;
 visitor.window.MikuTrafficGlobe=class{setData(routes,target,servers){payload={routes,target,servers};}setOptions(){}};
 v.state.nodes=[{...node},{...node,uuid:'jp-2',name:'备用服务器'}];v.state.loading=false;v.state.connection='live';v.state.snapshot={online:new Set([node.uuid]),reports:{[node.uuid]:{network:{up:1024}}}};
 v.syncGlobe();const location={lat:payload.servers[0].lat,lng:payload.servers[0].lng};v.handleClick({target:{closest:()=>({dataset:{globeRename:node.uuid}})}});
 visitor.element('globe-label-name').value='  音乐主舞台 ♪  ';assert.equal(v.saveGlobeLabel(),true);assert.equal(payload.routes[0].name,'音乐主舞台 ♪');assert.equal(payload.servers[0].name,'音乐主舞台 ♪');assert.deepEqual({lat:payload.servers[0].lat,lng:payload.servers[0].lng},location);
 assert.match(visitor.element('globe-routes').innerHTML,/<strong>音乐主舞台 ♪<\/strong>/);assert.match(visitor.element('globe-routes').innerHTML,/data-globe-rename="jp-1"/);assert.equal(v.state.nodes[0].name,node.name);assert.doesNotMatch(v.renderCard(v.state.nodes[0]),/音乐主舞台/);
 v.openGlobeGroup([node.uuid,'jp-2']);assert.match(visitor.element('globe-group-content').innerHTML,/音乐主舞台 ♪/);assert.match(visitor.element('globe-group-content').innerHTML,/<small>东京服务器<\/small>/);assert.equal(requests,0);
});
test('Marker names persist by UUID across reload, original-name changes, sorting and appearance reset',()=>{
 const storage={},first=load(true,null,storage),other={...node,uuid:'jp-2',name:'备用服务器'};first.api.state.nodes=[node,other];
 for(const [uuid,name] of [[node.uuid,'主音轨'],[other.uuid,'副音轨']]){first.api.openGlobeLabelEditor(uuid);first.element('globe-label-name').value=name;first.api.saveGlobeLabel();}
 assert.deepEqual(JSON.parse(storage['miku39.globe-labels.v1']),{[node.uuid]:'主音轨',[other.uuid]:'副音轨'});
 const second=load(true,null,storage);second.api.state.nodes=[other,{...node,name:'东京服务器新版'}];assert.equal(second.api.globeName(second.api.state.nodes[1]),'主音轨');assert.equal(second.api.globeName(other),'副音轨');
 second.api.handleClick({target:{closest:()=>({dataset:{action:'restore-settings'}})}});assert.equal(second.api.globeName(second.api.state.nodes[1]),'主音轨');assert.equal(second.api.globeName(other),'副音轨');assert.equal(second.api.globeName({...node,uuid:'new-uuid'}),node.name);
});
test('Blank names and the restore button reset only the selected server',()=>{
 const storage={'miku39.globe-labels.v1':JSON.stringify({[node.uuid]:'主音轨','jp-2':'副音轨'})},visitor=load(true,null,storage),other={...node,uuid:'jp-2',name:'备用服务器'},v=visitor.api;v.state.nodes=[node,other];
 v.openGlobeLabelEditor(node.uuid);visitor.element('globe-label-name').value='   ';assert.equal(v.saveGlobeLabel(),true);assert.equal(v.globeName(node),node.name);assert.equal(v.globeName(other),'副音轨');assert.deepEqual(JSON.parse(storage['miku39.globe-labels.v1']),{'jp-2':'副音轨'});
 v.openGlobeLabelEditor(other.uuid);visitor.element('globe-label-name').value='未保存草稿';v.handleClick({target:{closest:()=>({dataset:{action:'restore-globe-label'}})}});assert.equal(v.globeName(other),other.name);assert.deepEqual(JSON.parse(storage['miku39.globe-labels.v1']),{});
});
test('Name validation preserves valid aliases, accepts Unicode and safely filters malformed stored data',()=>{
 const visitor=load(true,null,{'miku39.globe-labels.v1':JSON.stringify({[node.uuid]:'上次保存'})}),v=visitor.api;v.state.nodes=[node];v.openGlobeLabelEditor(node.uuid);
 for(const invalid of ['长'.repeat(33),'名\t称','名\n称','名\u0000称']){visitor.element('globe-label-name').value=invalid;assert.equal(v.saveGlobeLabel(),false);assert.equal(v.globeName(node),'上次保存');assert.equal(visitor.element('globe-label-dialog').open,true);assert.equal(visitor.element('globe-label-name').getAttribute('aria-invalid'),'true');}
 visitor.element('globe-label-name').value='🎵'.repeat(32);assert.equal(v.saveGlobeLabel(),true);assert.equal(v.globeName(node),'🎵'.repeat(32));assert.equal(v.parseGlobeLabel('🎵'.repeat(33)),null);
 const normalized=v.normalizeGlobeLabels(JSON.parse('{"valid":"  正常  ","wrong":5,"nested":{"name":"bad"},"blank":" ","__proto__":"安全别名","constructor":"另一个别名"}'));assert.equal(Object.getPrototypeOf(normalized),null);assert.equal(normalized.valid,'正常');assert.equal(normalized.wrong,undefined);assert.equal(normalized.nested,undefined);assert.equal(normalized.blank,undefined);assert.equal(normalized.__proto__,'安全别名');assert.equal({}.polluted,undefined);
 for(const malformed of ['null','[]','["alias"]','"alias"','{broken'])assert.equal(load(true,null,{'miku39.globe-labels.v1':malformed}).api.globeName(node),node.name);
});
test('Custom marker names are escaped in markup and original names stay plain text in the editor',()=>{
 const visitor=load(true),v=visitor.api,original={...node,name:'<b>原名</b>'};v.state.nodes=[original,{...node,uuid:'jp-2'}];v.openGlobeLabelEditor(node.uuid);assert.equal(visitor.element('globe-label-server').textContent,'服务器原名：<b>原名</b>');assert.equal(visitor.element('globe-label-name').placeholder,'<b>原名</b>');
 visitor.element('globe-label-name').value='<img src=x onerror=alert(1)>';assert.equal(v.saveGlobeLabel(),true);const list=visitor.element('globe-routes').innerHTML;assert.match(list,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(list,/<img src=x|<b>原名/);
 v.openGlobeGroup([node.uuid,'jp-2']);assert.doesNotMatch(visitor.element('globe-group-content').innerHTML,/<img src=x|<b>原名/);assert.match(visitor.element('globe-group-content').innerHTML,/&lt;img src=x/);
});
test('Live refreshes keep editor drafts intact; cancel discards them and form submission saves explicitly',()=>{
 const storage={},visitor=load(true,null,storage),v=visitor.api;v.renderShell();v.state.nodes=[node];v.state.loading=false;v.state.connection='demo';v.state.snapshot={online:new Set([node.uuid]),reports:{[node.uuid]:{cpu:{usage:20},network:{up:1024}}}};
 v.openGlobeLabelEditor(node.uuid);const input=visitor.element('globe-label-name');input.value='尚未保存';for(let i=0;i<10;i++){v.state.snapshot.reports[node.uuid].cpu.usage=i;v.render();}assert.equal(visitor.element('globe-label-name'),input);assert.equal(input.value,'尚未保存');assert.equal(v.globeName(node),node.name);assert.equal(storage['miku39.globe-labels.v1'],undefined);
 v.handleClick({target:{closest:()=>({dataset:{close:'globe-label-dialog'}})}});assert.equal(v.state.globeLabelUUID,null);v.openGlobeLabelEditor(node.uuid);assert.equal(input.value,'');input.value='已经保存';let prevented=false;visitor.element('globe-label-form').dispatchEvent({type:'submit',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(v.globeName(node),'已经保存');assert.equal(visitor.element('globe-label-dialog').open,false);
 v.openGlobeLabelEditor(node.uuid);input.value='删除后草稿';v.state.nodes=[];assert.equal(v.saveGlobeLabel(),false);assert.equal(JSON.parse(storage['miku39.globe-labels.v1'])[node.uuid],'已经保存');assert.match(visitor.element('globe-label-error').textContent,/已不在列表/);
});
test('Storage failure still applies the name for the current session and reports persistence failure',()=>{
 const visitor=load(true),v=visitor.api;v.state.nodes=[node];v.openGlobeLabelEditor(node.uuid);visitor.element('globe-label-name').value='会话名称';visitor.context.localStorage.setItem=()=>{throw Error('Storage disabled');};assert.equal(v.saveGlobeLabel(),true);assert.equal(v.globeName(node),'会话名称');assert.match(visitor.element('globe-routes').innerHTML,/会话名称/);assert.match(visitor.element('toast').textContent,/浏览器无法保存/);
});
test('Changing a marker name preserves its coordinates, group, route path, phase and UUID focus',()=>{
 const scene=Object.create(Globe.prototype);Object.assign(scene,{routeCache:new Map(),pulse:0,wake(){},options:{motion:false},reduced:{matches:false},yaw:0,pitch:0,cx:150,cy:150,radius:100});
 const servers=[{uuid:'one',name:'One',lat:0,lng:0,status:'online',speed:1024},{uuid:'two',name:'Two',lat:0,lng:0,status:'offline',speed:0}];scene.setData([servers[0]],destination,servers);scene.advance(32);scene.focusServer('one',true);
 const marker=scene.markerCache.get('one'),position=marker.position,group=scene.markerGroups[0],route=scene.routes[0],points=route.points,phase=route.phase;const changed=servers.map(server=>({...server,name:server.uuid==='one'?'自定义主舞台':server.name}));scene.setData([changed[0]],destination,changed);
 assert.equal(scene.markerCache.get('one'),marker);assert.equal(marker.position,position);assert.equal(scene.markerGroups[0],group);assert.equal(group.name,'自定义主舞台 +1');assert.equal(scene.routes[0],route);assert.equal(route.points,points);assert.equal(route.phase,phase);assert.equal(scene.selectedUUID,'one');assert.equal(scene.pick(150,150).uuid,'one');assert.equal(marker.name,'自定义主舞台');assert.equal(route.name,'自定义主舞台');
});
test('Renaming a list entry preserves its DOM row, flag, focus button and edit control',()=>{
 const visitor=load(true),v=visitor.api;v.state.nodes=[node];v.syncGlobe();const list=domDocument.createElement('div');patch(list,visitor.element('globe-routes').innerHTML);const row=list.firstChild,flag=list.querySelector('img'),focus=list.querySelector('[data-globe-server="jp-1"]'),edit=list.querySelector('[data-globe-rename="jp-1"]'),before=descendants(list);domDocument.reset();
 v.openGlobeLabelEditor(node.uuid);visitor.element('globe-label-name').value='舞台别名';v.saveGlobeLabel();patch(list,visitor.element('globe-routes').innerHTML);assert.equal(list.firstChild,row);assert.equal(list.querySelector('img'),flag);assert.equal(list.querySelector('[data-globe-server="jp-1"]'),focus);assert.equal(list.querySelector('[data-globe-rename="jp-1"]'),edit);assert.ok(liveMutations(before).every(m=>m.kind==='text'||m.kind==='attribute'));assert.match(list.textContent,/舞台别名/);
});
test('Traffic and billing refreshes preserve existing card sections and SVG elements',()=>{
 const section=container.querySelector('[data-render-key="server-traffic"]'),billing=container.querySelector('[data-render-key="server-billing"]'),flag=container.querySelector('img'),before=descendants(container);domDocument.reset();
 a.state.snapshot.reports[node.uuid].network.totalUp=2*1024**3;a.state.snapshot.reports[node.uuid].network.totalDown=3*1024**3;
 patch(container,a.renderCard({...node,price:12,currency:'USD',billing_cycle:30,expired_at:'2027-04-13T00:00:00Z'}));assert.equal(container.querySelector('[data-render-key="server-traffic"]'),section);assert.equal(container.querySelector('[data-render-key="server-billing"]'),billing);assert.equal(container.querySelector('img'),flag);assert.ok(liveMutations(before).every(m=>m.kind!=='remove'));
});
test('Production marker drawing shows idle and offline positions, clustered counts and excludes the far side',()=>{
 const arcs=[],strokes=[],texts=[],labels=[],ctx={save(){},restore(){},beginPath(){},arc(x,y,r){arcs.push({x,y,r});},fill(){},stroke(){strokes.push(this.strokeStyle);},fillText(text){texts.push(text);},measureText:text=>({width:String(text).length*6})};
 const scene=Object.create(Globe.prototype);Object.assign(scene,{routeCache:new Map(),pulse:0,wake(){},options:{motion:false,light:false},reduced:{matches:false},yaw:0,pitch:0,cx:150,cy:150,radius:100,width:300,height:300,ctx,label:(x,y,text)=>labels.push(text)});
 const servers=[{uuid:'a',name:'Idle',lat:0,lng:0,status:'online',speed:0},{uuid:'b',name:'Shared',lat:0,lng:0,status:'offline',speed:0},{uuid:'c',name:'Offline',lat:35,lng:45,status:'offline',speed:0},{uuid:'d',name:'Far',lat:0,lng:180,status:'online',speed:0}];
 scene.setData([],destination,servers);scene.drawMarkers();assert.equal(arcs.length,2);assert.ok(arcs.some(arc=>arc.x===150&&arc.y===150&&arc.r===7));assert.deepEqual(texts,['2']);assert.ok(strokes.includes('#9deedb'));assert.ok(strokes.includes('#f5a2c6'));assert.ok(labels.includes('Offline'));assert.ok(labels.every(text=>text!=='Far'));
});
test('Theme-owned Chinese copy consistently says server while legacy API and fragment names stay compatible',()=>{
 for(const name of ['app.js','regions.js','index.html'])assert.doesNotMatch(fs.readFileSync(root+'/dist/'+name,'utf8'),/节点/);
 assert.doesNotMatch(fs.readFileSync(root+'/scripts/make_preview.py','utf8'),/节点/);
 const app=fs.readFileSync(root+'/dist/app.js','utf8');assert.match(app,/\/api\/nodes/);assert.match(app,/#node=/);assert.match(app,/服务器概览/);assert.doesNotMatch(JSON.stringify(meta),/节点/);
});
const asyncTest=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
const click=(api,dataset)=>api.handleClick({target:{closest:()=>({dataset})}});
test('Old wallpaper preferences migrate without changing appearance; unsafe links are not restored',()=>{
 const old=load(true,null,{'miku39.preferences.v1':JSON.stringify({wallpaper:'starlight',dim:80,nodeSize:'large'})});
 assert.equal(old.api.prefs.backgroundSource,'builtin');assert.equal(old.api.prefs.wallpaper,'starlight');assert.equal(old.api.prefs.dim,80);assert.equal(old.api.prefs.nodeSize,'large');
 const invalid=load(true,null,{'miku39.preferences.v1':JSON.stringify({backgroundSource:'url',backgroundURL:'javascript:alert(1)'})});assert.equal(invalid.api.prefs.backgroundSource,'builtin');assert.equal(invalid.api.prefs.backgroundURL,'');
});
await asyncTest('Image links load before commit, survive reload and do not participate in rotation',async()=>{
 const fixture=backgroundBrowser(),storage={},visitor=load(true,null,storage,fixture.browser),v=visitor.api;
 v.prefs.rotate=true;v.prefs.dim=77;v.prefs.nodeSize='large';let rotations=0;visitor.context.setInterval=()=>++rotations;
 assert.equal(await v.selectCustomWallpaper('url',' https://cdn.test/background.webp '),true);
 assert.equal(v.currentWallpaper(),'https://cdn.test/background.webp');assert.equal(v.prefs.backgroundSource,'url');assert.equal(rotations,0);
 assert.equal(v.prefs.dim,77);assert.equal(v.prefs.nodeSize,'large');
 const reloaded=load(true,null,storage,fixture.browser);assert.match(reloaded.api.currentWallpaper(),/daydream/);await reloaded.api.restoreCustomBackground();assert.equal(reloaded.api.currentWallpaper(),'https://cdn.test/background.webp');
});
await asyncTest('Invalid, insecure and broken links retain the previously applied background',async()=>{
 const fixture=backgroundBrowser(),visitor=load(true,null,{},fixture.browser),v=visitor.api;
 await v.selectCustomWallpaper('url','https://cdn.test/good.webp');fixture.broken.add('https://cdn.test/broken.webp');
 for(const value of ['javascript:alert(1)','data:image/png;base64,AAAA','https://user:secret@cdn.test/a.png','http://cdn.test/a.png','https://cdn.test/broken.webp']){
  assert.equal(await v.selectCustomWallpaper('url',value),false);assert.equal(v.currentWallpaper(),'https://cdn.test/good.webp');assert.equal(v.prefs.backgroundURL,'https://cdn.test/good.webp');assert.ok(v.background.error);
 }
});
await asyncTest('Local files persist in the image database and refresh restores their own object URL',async()=>{
 const fixture=backgroundBrowser(),storage={},visitor=load(true,null,storage,fixture.browser),v=visitor.api,file=imageFile('my-holiday.webp');
 assert.equal(await v.selectCustomWallpaper('local',file),true);assert.equal(v.prefs.backgroundSource,'local');assert.equal(fixture.records.record.blob,file);assert.equal(v.background.local.name,file.name);
 const original=v.currentWallpaper();const reloaded=load(true,null,storage,fixture.browser);await reloaded.api.restoreCustomBackground();
 assert.match(reloaded.api.currentWallpaper(),/^blob:/);assert.notEqual(reloaded.api.currentWallpaper(),original);assert.equal(reloaded.api.background.local.name,file.name);
 const saved=JSON.parse(storage['miku39.preferences.v1']);assert.equal(saved.backgroundSource,'local');assert.doesNotMatch(storage['miku39.preferences.v1'],/blob:test|my-holiday/);
});
await asyncTest('Bad file types, oversized images, decode errors and storage failures preserve the saved image',async()=>{
 const fixture=backgroundBrowser(),visitor=load(true,null,{},fixture.browser),v=visitor.api;
 await v.selectCustomWallpaper('local',imageFile());const original=v.currentWallpaper(),record=fixture.records.record;
 for(const file of [imageFile('file.txt',32,'text/plain'),imageFile('large.png',10*1024*1024+1,'image/png'),imageFile('empty.png',0,'image/png'),imageFile('broken.png',100,'image/png')]){
  assert.equal(await v.selectCustomWallpaper('local',file),false);assert.equal(v.currentWallpaper(),original);assert.equal(fixture.records.record,record);
 }
 fixture.records.failWrites=true;assert.equal(await v.selectCustomWallpaper('local',imageFile('another.webp')),false);assert.equal(v.currentWallpaper(),original);assert.equal(fixture.records.record,record);assert.ok(fixture.revoked.size>=2);
});
await asyncTest('Resetting or choosing an internal wallpaper cancels pending link work and retains saved local images',async()=>{
 const fixture=backgroundBrowser(),visitor=load(true,null,{},fixture.browser),v=visitor.api;await v.selectCustomWallpaper('local',imageFile());
 const pending=v.selectCustomWallpaper('url','https://cdn.test/pending.webp');click(v,{action:'restore-background'});assert.equal(await pending,false);
 fixture.pending.get('https://cdn.test/pending.webp')?.();assert.equal(v.prefs.backgroundSource,'builtin');assert.match(v.currentWallpaper(),/daydream/);
 v.useSavedWallpaper();assert.equal(v.prefs.backgroundSource,'local');v.useBuiltinWallpaper('starlight');assert.equal(v.prefs.backgroundSource,'builtin');assert.match(v.currentWallpaper(),/starlight/);assert.ok(fixture.records.record);
});
await asyncTest('Missing saved files fall back safely, and disabled preference storage still applies a valid URL',async()=>{
 const fixture=backgroundBrowser(),visitor=load(true,null,{'miku39.preferences.v1':JSON.stringify({backgroundSource:'local'})},fixture.browser),v=visitor.api;
 await v.restoreCustomBackground();assert.match(v.currentWallpaper(),/daydream/);assert.match(v.background.error,/无法读取/);
 visitor.context.localStorage.setItem=()=>{throw Error('Storage disabled');};assert.equal(await v.selectCustomWallpaper('url','https://cdn.test/valid.webp'),true);assert.equal(v.currentWallpaper(),'https://cdn.test/valid.webp');assert.match(visitor.element('toast').textContent,/浏览器无法保存偏好/);
 const unsupported=load(true,null,{}, {...fixture.browser,indexedDB:undefined});assert.equal(await unsupported.api.selectCustomWallpaper('local',imageFile()),false);assert.match(unsupported.api.background.error,/改用图片链接/);
});
test('Background settings escape names and link drafts, retain typing and provide both upload controls',()=>{
 const visitor=load(true),v=visitor.api;visitor.element('wallpaper-url').value='"><img src=x onerror=alert(1)>';v.background.local={url:'blob:local',name:'<svg onload=alert(1)>.webp'};v.renderWallpapers();
 const settings=visitor.element('wallpaper-options').innerHTML;assert.doesNotMatch(settings,/<svg onload|<img src=x/);assert.match(settings,/&lt;svg/);assert.match(settings,/id="wallpaper-file"/);assert.match(settings,/id="wallpaper-url-form"/);assert.match(settings,/&quot;&gt;&lt;img/);
 assert.equal(visitor.element('wallpaper-url').value,'"><img src=x onerror=alert(1)>');
 const index=fs.readFileSync(root+'/dist/index.html','utf8');assert.ok(index.indexOf('backgrounds.js')<index.indexOf('app.js'));
});

test('Market manifest metadata uses valid plain-text fields',()=>{
 for(const field of ['name','short','version','author','description']){
  assert.equal(typeof meta[field],'string',field+' must be a string');
  assert.ok(meta[field].trim(),field+' must not be empty');
 }
 assert.match(meta.short,/^[A-Za-z0-9_-]+$/);
 assert.equal(meta.name,'初音未来 · Miku39');
 assert.equal(meta.configuration.name['zh-CN'],'Miku 主题设置');
});
console.log(`${checks} checks passed`);
