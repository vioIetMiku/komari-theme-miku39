/* Province-level destinations use representative points, not region boundaries. */
(()=>{
'use strict';
const groups=[
 ['直辖市',[
  ['beijing','北京市',39.9042,116.4074],['tianjin','天津市',39.0842,117.2009],
  ['shanghai','上海市',31.2304,121.4737],['chongqing','重庆市',29.5630,106.5516]
 ]],
 ['省',[
  ['hebei','河北省',38.0428,114.5149],['shanxi','山西省',37.8706,112.5489],
  ['liaoning','辽宁省',41.8057,123.4315],['jilin','吉林省',43.8171,125.3235],
  ['heilongjiang','黑龙江省',45.8038,126.5349],['jiangsu','江苏省',32.0603,118.7969],
  ['zhejiang','浙江省',30.2741,120.1551],['anhui','安徽省',31.8206,117.2272],
  ['fujian','福建省',26.0745,119.2965],['jiangxi','江西省',28.6829,115.8582],
  ['shandong','山东省',36.6512,117.1201],['henan','河南省',34.7466,113.6254],
  ['hubei','湖北省',30.5928,114.3055],['hunan','湖南省',28.2282,112.9388],
  ['guangdong','广东省',23.1291,113.2644],['hainan','海南省',20.0440,110.1999],
  ['sichuan','四川省',30.5728,104.0668],['guizhou','贵州省',26.6470,106.6302],
  ['yunnan','云南省',25.0389,102.7183],['shaanxi','陕西省',34.3416,108.9398],
  ['gansu','甘肃省',36.0611,103.8343],['qinghai','青海省',36.6171,101.7782],
  ['taiwan','台湾省',25.0330,121.5654]
 ]],
 ['自治区',[
  ['inner-mongolia','内蒙古自治区',40.8426,111.7492],['guangxi','广西壮族自治区',22.8170,108.3669],
  ['tibet','西藏自治区',29.6525,91.1721],['ningxia','宁夏回族自治区',38.4872,106.2309],
  ['xinjiang','新疆维吾尔自治区',43.8256,87.6168]
 ]],
 ['特别行政区',[
  ['hongkong','香港特别行政区',22.3193,114.1694],['macau','澳门特别行政区',22.1987,113.5439]
 ]]
];
const targets={china:{name:'中国',label:'中国',scope:'country',lat:35.8617,lng:104.1954}};
for(const [,regions] of groups)for(const [id,name,lat,lng] of regions)targets[id]={name,label:'中国 · '+name,scope:'region',lat,lng};
function customTarget(value){
 if(!value||typeof value!=='object')return null;
 const name=typeof value.name==='string'?value.name.trim().slice(0,32):'';
 const number=v=>typeof v==='number'||typeof v==='string'&&v.trim()!==''?Number(v):NaN;
 const lat=number(value.lat),lng=number(value.lng);
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return null;
 return {name,label:name==='中国'?'中国':'中国 · '+name,scope:'custom',lat,lng};
}
window.MikuDestinations={groups,targets,customTarget};
})();
