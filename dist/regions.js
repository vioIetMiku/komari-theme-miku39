/* Miku39 country and location helpers. Offline; no IP lookup service. */
(()=>{
'use strict';
const countries={
 CN:[35,105],HK:[22.3193,114.1694],MO:[22.1987,113.5439],TW:[23.7,121],JP:[36.2,138.3],SG:[1.3521,103.8198],KR:[36.5,127.8],US:[39.8,-98.6],CA:[56.1,-106.3],GB:[54,-2],DE:[51.2,10.4],FR:[46.6,2.2],NL:[52.1,5.3],FI:[64,26],RU:[61,95],IT:[42.8,12.8],ES:[40.4,-3.7],CH:[46.8,8.2],SE:[62,15],NO:[62,10],AT:[47.5,14.5],AU:[-25.3,133.8],NZ:[-41,174],IN:[22,79],VN:[16,108],TH:[15.9,100.9],ID:[-2,118],MY:[4.2,102],PH:[12.9,121.8],BR:[-14.2,-51.9],TR:[39,35],AE:[24,54],ZA:[-30.6,22.9],SA:[24,45],IL:[31.5,34.8],PL:[52,19],IE:[53.1,-8],IS:[65,-19],LU:[49.8,6.1],BE:[50.8,4.5],PT:[39.5,-8],DK:[56,10],AR:[-38.4,-63.6],CL:[-35.7,-71.5],MX:[23.6,-102.5],BD:[23.7,90.4],PK:[30.4,69.3],UA:[49,32],KZ:[48,67],LT:[55.2,23.9],LV:[56.9,24.6],EE:[58.6,25],GR:[39,22],HU:[47.2,19.5],CZ:[49.8,15.5],RO:[46,25],BG:[42.7,25.5],HR:[45.1,15.2],RS:[44,21],SI:[46.1,14.9],SK:[48.7,19.7],GE:[42.3,43.4],AM:[40.1,45],AZ:[40.1,47.6],IR:[32,54],IQ:[33,44],EG:[26,30],KE:[.02,38],NG:[9.1,8.7],MA:[32,-6],TN:[34,9],PE:[-9,-75],CO:[4,-74],EC:[-1.8,-78.2],UY:[-32.5,-55.8],VE:[7,-66],CR:[10,-84],PA:[9,-80],CU:[22,-79],NP:[28,84],LK:[7.8,80.7],MM:[21.9,96],KH:[12.6,105],LA:[18,103],MN:[46.9,103.8],UZ:[41,64],KG:[41.2,74.7],CY:[35,33],MT:[35.9,14.4]
};
const aliases={
 china:'CN',prc:'CN',chn:'CN','中国':'CN','中国大陆':'CN','大陆':'CN',japan:'JP',jpn:'JP','日本':'JP',singapore:'SG',sgp:'SG','新加坡':'SG',hongkong:'HK',hkg:'HK','香港':'HK','中国香港':'HK',macau:'MO',macao:'MO','澳门':'MO',taiwan:'TW',twn:'TW','台湾':'TW','中国台湾':'TW',southkorea:'KR',korea:'KR',kor:'KR','韩国':'KR',usa:'US',unitedstates:'US',america:'US','美国':'US',canada:'CA',can:'CA','加拿大':'CA',uk:'GB',gbr:'GB',unitedkingdom:'GB','英国':'GB',germany:'DE',deu:'DE','德国':'DE',france:'FR',fra:'FR','法国':'FR',netherlands:'NL',nld:'NL','荷兰':'NL',finland:'FI',fin:'FI','芬兰':'FI',russia:'RU',rus:'RU','俄罗斯':'RU',australia:'AU',aus:'AU','澳大利亚':'AU',newzealand:'NZ',nzl:'NZ','新西兰':'NZ',india:'IN',ind:'IN','印度':'IN',vietnam:'VN',vnm:'VN','越南':'VN',thailand:'TH',tha:'TH','泰国':'TH',malaysia:'MY',mys:'MY','马来西亚':'MY',indonesia:'ID',idn:'ID','印度尼西亚':'ID',philippines:'PH',phl:'PH','菲律宾':'PH',sweden:'SE',swe:'SE','瑞典':'SE',norway:'NO',nor:'NO','挪威':'NO',switzerland:'CH',che:'CH','瑞士':'CH',italy:'IT',ita:'IT','意大利':'IT',spain:'ES',esp:'ES','西班牙':'ES',turkey:'TR',turkiye:'TR',tur:'TR','土耳其':'TR',brazil:'BR',bra:'BR','巴西':'BR',uae:'AE',are:'AE','阿联酋':'AE',poland:'PL',pol:'PL','波兰':'PL',ireland:'IE',irl:'IE','爱尔兰':'IE'
};
const cities=[
 ['JP',/东京|東京|tokyo/i,35.6762,139.6503],['JP',/大阪|osaka/i,34.6937,135.5023],['US',/洛杉矶|los.?angeles|\bLAX\b/i,34.0522,-118.2437],['US',/纽约|new.?york|\bNYC\b/i,40.7128,-74.006],['US',/西雅图|seattle/i,47.6062,-122.3321],['US',/圣何塞|san.?jose/i,37.3382,-121.8863],['US',/达拉斯|dallas/i,32.7767,-96.797],['US',/芝加哥|chicago/i,41.8781,-87.6298],['DE',/法兰克福|frankfurt/i,50.1109,8.6821],['DE',/柏林|berlin/i,52.52,13.405],['GB',/伦敦|london/i,51.5074,-.1278],['FR',/巴黎|paris/i,48.8566,2.3522],['NL',/阿姆斯特丹|amsterdam/i,52.3676,4.9041],['CA',/多伦多|toronto/i,43.6532,-79.3832],['CA',/温哥华|vancouver/i,49.2827,-123.1207],['AU',/悉尼|sydney/i,-33.8688,151.2093],['KR',/首尔|seoul/i,37.5665,126.978],['CN',/北京|beijing/i,39.9042,116.4074],['CN',/上海|shanghai/i,31.2304,121.4737],['CN',/广州|guangzhou/i,23.1291,113.2644],['CN',/深圳|shenzhen/i,22.5431,114.0579]
];
let names;try{names=new Intl.DisplayNames(['zh-CN'],{type:'region'});}catch{}
function resolveCountry(value){
 const input=String(value||'').trim();
 const emoji=[...input].filter(c=>c.codePointAt(0)>=0x1f1e6&&c.codePointAt(0)<=0x1f1ff);
 if(emoji.length===2)return emoji.map(c=>String.fromCharCode(c.codePointAt(0)-127397)).join('');
 const key=input.toLowerCase().replace(/[\s_·.-]+/g,'');
 if(aliases[key])return aliases[key];
 const upper=input.toUpperCase();
 if(/^[A-Z]{2}$/.test(upper)){try{return names&&names.of(upper)!==upper?upper:(countries[upper]?upper:'');}catch{return countries[upper]?upper:'';}}
 for(const part of input.split(/[\s/|,，()（）·-]+/)){const k=part.toLowerCase();if(aliases[k])return aliases[k];const c=part.toUpperCase();if(countries[c])return c;}
 for(const [alias,code] of Object.entries(aliases))if(alias.length>=3&&/[\u4e00-\u9fff]/.test(alias)&&input.includes(alias))return code;
 return '';
}
function countryName(code){try{return code?(names?.of(code)||code):'地区未知';}catch{return code||'地区未知';}}
function nodeCountry(n){return resolveCountry(n.region||n.country_code||n.country||n.location?.country||n.geo?.country);}
function nodeLocation(n){
 const country=nodeCountry(n),number=v=>v===null||v===undefined||v===''?NaN:Number(v);
 const lat=number(n.latitude??n.lat??n.location?.latitude??n.geo?.lat),lng=number(n.longitude??n.lng??n.lon??n.location?.longitude??n.geo?.lng);
 if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)return {lat,lng,country,source:'服务器坐标'};
 const city=cities.find(([c,re])=>c===country&&re.test(String(n.name)+' '+String(n.region)));
 if(city)return {lat:city[2],lng:city[3],country,source:'按名称中的城市示意定位'};
 const p=countries[country];return p?{lat:p[0],lng:p[1],country,source:'按地区代表点示意定位'}:null;
}
window.MikuRegions={resolveCountry,countryName,nodeCountry,nodeLocation,countries};
})();
