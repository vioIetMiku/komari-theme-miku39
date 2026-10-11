/* Measurement-backed rhythm tracks. Decorative motion never changes a value. */
(()=>{
'use strict';
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const binsCache=new WeakMap(),miniCache=new WeakMap();
function bins(series,maxBins=32){
 maxBins=Math.max(1,Math.min(192,Math.floor(maxBins)||32));
 const cached=binsCache.get(series);if(cached?.has(maxBins))return cached.get(maxBins);
 const points=series.filter(point=>Number.isFinite(point.time)).sort((a,b)=>a.time-b.time);
 if(!points.length)return [];
 const start=points[0].time,end=points.at(-1).time,count=start===end?1:Math.min(maxBins,points.length);
 const result=Array.from({length:count},(_,i)=>({time:start+(end-start)*(i+.5)/count,first:null,last:null,value:null,failed:0,missing:0,count:0}));
 for(const point of points){const index=Math.min(count-1,Math.floor((point.time-start)/Math.max(1,end-start)*count)),bucket=result[index],value=number(point.value);bucket.first??=point.time;bucket.last=point.time;bucket.count++;if(value===null)bucket.missing++;else{if(value<0||point.failed===true)bucket.failed++;if(value>=0)bucket.value=Math.max(bucket.value??0,value);}}
 const cache=cached||new Map();cache.set(maxBins,result);binsCache.set(series,cache);return result;
}
function mini(series,{label='采样节拍',unit=' ms',max=null,color='var(--accent)',escape=value=>String(value)}={}){
 const key=JSON.stringify([escape(label),escape(unit),max,color]),cached=miniCache.get(series);if(cached?.has(key))return cached.get(key);
 const columns=bins(series),valid=columns.filter(point=>point.value!==null),failures=columns.reduce((sum,point)=>sum+point.failed,0);
 if(!valid.length&&!failures)return `<span class="rhythm-empty" role="img" aria-label="${escape(label)}：暂无有效采样">— 暂无采样 —</span>`;
 const width=384,height=30,upper=max??Math.max(1,...valid.map(point=>point.value))*1.18,step=width/columns.length,barWidth=Math.min(8,step*.56),baseline=height-3;
 const staff=Array.from({length:5},(_,i)=>`<line x1="0" x2="${width}" y1="${3+i*6}" y2="${3+i*6}" class="rhythm-staff"/>`).join('');
 const bars=columns.map((point,i)=>{
  const x=(i+.5)*step;
  let markup='';
  if(point.value!==null){const amplitude=point.value/upper*(height-8),h=Math.max(1.3,amplitude);markup=`<rect x="${(x-barWidth/2).toFixed(2)}" y="${(baseline-h).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" rx=".8" fill="${color}" opacity=".68"/><path d="M${(x-barWidth/2).toFixed(2)},${(baseline-h).toFixed(2)}h${barWidth.toFixed(2)}" stroke="${color}" stroke-width=".8"/>`;}
  if(point.failed)markup+=`<path d="M${x-3},4l6,6m-6,0l6,-6" class="rhythm-break"/>`;
  if(point.missing||!point.count)markup+=`<path d="M${x-2},${baseline}h4" class="rhythm-missing"/>`;
  return markup;
 }).join('');
 const top=valid.length?Math.max(...valid.map(point=>point.value)):null;
 const markup=`<span class="rhythm-sample" data-rhythm-sample><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escape(label)}，${series.length} 个采样${top===null?'':`，区间峰值 ${top.toFixed(1)}${escape(unit)}`}，${failures} 次失败；每柱为时间区间峰值，缺失留空">${staff}${bars}</svg><span class="rhythm-playhead" aria-hidden="true"></span></span>`;
 const cache=cached||new Map();cache.set(key,markup);miniCache.set(series,cache);return markup;
}
window.MikuMusic={bins,mini};
})();
