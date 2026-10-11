"""Create offline vector country icons; small flags use simplified emblem details."""
from pathlib import Path
import math

OUT = Path(__file__).resolve().parent.parent / 'dist/assets/flags'
OUT.mkdir(parents=True, exist_ok=True)
flags = {}
def rect(x,y,w,h,c): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>'
def circle(x,y,r,c): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
def path(d,c): return f'<path d="{d}" fill="{c}"/>'
def star(x,y,r,c,rotation=-90):
    pts=[]
    for i in range(10):
        a=math.radians(rotation+i*36); rr=r if i%2==0 else r*.382
        pts.append(f'{x+rr*math.cos(a):.2f},{y+rr*math.sin(a):.2f}')
    return f'<polygon points="{" ".join(pts)}" fill="{c}"/>'
def stripes(colors,vertical=False):
    step=(30 if vertical else 20)/len(colors)
    return ''.join(rect(i*step if vertical else 0,0 if vertical else i*step,step if vertical else 30,20 if vertical else step,c) for i,c in enumerate(colors))
for code,colors in {'DE':['#000','#d00','#ffce00'],'NL':['#ae1c28','#fff','#21468b'],'RU':['#fff','#0039a6','#d52b1e'],'AT':['#ed2939','#fff','#ed2939'],'HU':['#ce2939','#fff','#477050'],'BG':['#fff','#00966e','#d62612'],'LT':['#fdb913','#006a44','#c1272d'],'EE':['#4891d9','#000','#fff'],'LU':['#ed2939','#fff','#00a1de'],'UA':['#0057b7','#ffd700'],'ID':['#ff0000','#fff'],'PL':['#fff','#dc143c'],'MC':['#ce1126','#fff'],'RO':['#002b7f','#fcd116','#ce1126'],'FR':['#002654','#fff','#ed2939'],'IT':['#009246','#fff','#ce2b37'],'IE':['#169b62','#fff','#ff883e'],'BE':['#000','#fdda24','#ef3340'],'AM':['#d90012','#0033a0','#f2a800'],'NG':['#008751','#fff','#008751'],'PE':['#d91023','#fff','#d91023']}.items():
    flags[code]=stripes(colors,code in {'RO','FR','IT','IE','BE','NG','PE'})
flags['JP']=rect(0,0,30,20,'#fff')+circle(15,10,6,'#bc002d')
flags['CN']=rect(0,0,30,20,'#de2910')+star(5,5,3,'#ffde00')+''.join(star(x,y,1,'#ffde00',a) for x,y,a in [(10,2,140),(12,4,160),(12,7,180),(10,9,200)])
flags['HK']=rect(0,0,30,20,'#de2910')+''.join(f'<g transform="rotate({i*72} 15 10)"><path d="M15 10C9 9 11 3 15 4C13 5 16 7 15 10" fill="white"/>{star(13.5,6.5,.5,"#de2910")}</g>' for i in range(5))
flags['MO']=rect(0,0,30,20,'#00785e')+''.join(f'<ellipse cx="15" cy="10" rx="2" ry="4" transform="rotate({a} 15 13)" fill="#fff"/>' for a in [-45,-22,0,22,45])+rect(7,14,16,1,'#fff')+''.join(star(x,y,.8,'#ffda44') for x,y in [(8,5),(11,3),(15,2),(19,3),(22,5)])
flags['TW']=rect(0,0,30,20,'#fe0000')+rect(0,0,15,10,'#000095')+''.join(path(f'M7.5 1L8.3 5L6.7 5Z','#fff') if i==0 else f'<g transform="rotate({i*30} 7.5 5)">'+path('M7.5 1L8.3 5L6.7 5Z','#fff')+'</g>' for i in range(12))+circle(7.5,5,2.3,'#fff')
flags['SG']=stripes(['#ef3340','#fff'])+circle(5.5,5,3.2,'#fff')+circle(6.7,4.4,2.7,'#ef3340')+''.join(star(10+2*math.cos(i*math.pi*2/5-math.pi/2),5+2*math.sin(i*math.pi*2/5-math.pi/2),.65,'#fff') for i in range(5))
flags['US']=stripes(['#b22234' if i%2==0 else '#fff' for i in range(13)])+rect(0,0,12,10.77,'#3c3b6e')+''.join(star(1+x*2,1+y*1.1,.45,'#fff') for y in range(9) for x in range(6 if y%2==0 else 5))
union=rect(0,0,30,20,'#012169')+'<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.8"/>'+rect(12,0,6,20,'#fff')+rect(0,7,30,6,'#fff')+rect(13,0,4,20,'#c8102e')+rect(0,8,30,4,'#c8102e')
flags['GB']=union
for code,color,bg in [('SE','#fecc00','#006aa7'),('FI','#003580','#fff'),('DK','#fff','#c60c30'),('NO','#fff','#ba0c2f'),('IS','#fff','#02529c')]:
    flags[code]=rect(0,0,30,20,bg)+rect(9,0,4,20,color)+rect(0,8,30,4,color)
    if code in ['NO','IS']:flags[code]+=rect(10,0,2,20,'#00205b' if code=='NO' else '#dc1e35')+rect(0,9,30,2,'#00205b' if code=='NO' else '#dc1e35')
flags['CH']=rect(0,0,30,20,'#da291c')+rect(13,4,4,12,'#fff')+rect(9,8,12,4,'#fff')
flags['CA']=stripes(['#d80621','#fff','#d80621'],True)+path('M15 3L13.5 6.5L12 5.7L12.7 9L10 7.5L10.3 10L8.5 10.5L12.5 14L12 15L14.6 14.5L14.6 17L15.4 17L15.4 14.5L18 15L17.5 14L21.5 10.5L19.7 10L20 7.5L17.3 9L18 5.7L16.5 6.5Z','#d80621')
flags['AU']=rect(0,0,30,20,'#012169')+f'<g transform="scale(.5)">{union}</g>'+''.join(star(x,y,r,'#fff') for x,y,r in [(7.5,15,2),(23,4,1.5),(19,10,1.5),(27,9,1.5),(23,17,1.5),(24,12,.7)])
flags['NZ']=rect(0,0,30,20,'#012169')+f'<g transform="scale(.5)">{union}</g>'+''.join(star(x,y,1.8,'#fff')+star(x,y,1.3,'#c8102e') for x,y in [(23,4),(19,10),(27,9),(23,17)])
flags['KR']=rect(0,0,30,20,'#fff')+circle(15,10,4,'#cd2e3a')+path('M11 10A4 4 0 0 0 19 10A2 2 0 0 0 15 10A2 2 0 0 1 11 10','#0047a0')+''.join(f'<g transform="translate({x} {y}) rotate({a})">'+''.join(rect(-3,k*1.2,6,.65,'#000') for k in range(3))+'</g>' for x,y,a in [(6,4,-55),(24,4,55),(6,15,55),(24,15,-55)])
flags['TH']=stripes(['#a51931','#f4f5f8','#2d2a4a','#2d2a4a','#f4f5f8','#a51931'])
flags['VN']=rect(0,0,30,20,'#da251d')+star(15,10,6,'#ff0')
flags['IN']=stripes(['#ff9933','#fff','#138808'])+circle(15,10,2.5,'#000080')+circle(15,10,2.15,'#fff')+''.join(f'<path d="M15 10L{15+2.1*math.cos(i*math.pi/12):.2f} {10+2.1*math.sin(i*math.pi/12):.2f}" stroke="#000080" stroke-width=".2"/>' for i in range(24))
flags['BR']=rect(0,0,30,20,'#009b3a')+path('M3 10L15 2L27 10L15 18Z','#ffdf00')+circle(15,10,4.5,'#002776')+'<path d="M11 8.5Q15 8 19 11" fill="none" stroke="white" stroke-width="1"/>'
flags['TR']=rect(0,0,30,20,'#e30a17')+circle(12,10,5,'#fff')+circle(13.6,10,4,'#e30a17')+star(19,10,2.5,'#fff',0)
flags['BD']=rect(0,0,30,20,'#006a4e')+circle(13.5,10,6,'#f42a41')
flags['PK']=rect(0,0,30,20,'#01411c')+rect(0,0,7.5,20,'#fff')+circle(19,10,5,'#fff')+circle(21,8.5,4.5,'#01411c')+star(22,6,1.7,'#fff')
flags['AE']=stripes(['#00732f','#fff','#000'])+rect(0,0,7.5,20,'#ff0000')
flags['ES']=rect(0,0,30,20,'#aa151b')+rect(0,5,30,10,'#f1bf00')+rect(8,8,3,5,'#aa151b')+rect(7.5,7.5,4,1,'#aa151b')
flags['PT']=rect(0,0,30,20,'#ff0000')+rect(0,0,12,20,'#006600')+circle(12,10,4,'#ffda00')+path('M10 7H14V11Q12 14 10 11Z','#fff')+path('M11 8H13V10Q12 12 11 10Z','#d00')
flags['GR']=stripes(['#0d5eaf' if i%2==0 else '#fff' for i in range(9)])+rect(0,0,11,11,'#0d5eaf')+rect(4.4,0,2.2,11,'#fff')+rect(0,4.4,11,2.2,'#fff')
flags['CZ']=stripes(['#fff','#d7141a'])+path('M0 0L15 10L0 20Z','#11457e')
flags['LV']=rect(0,0,30,20,'#9e1b34')+rect(0,8,30,4,'#fff')
flags['PH']=stripes(['#0038a8','#ce1126'])+path('M0 0L16 10L0 20Z','#fff')+circle(5,10,2,'#fcd116')+''.join(star(x,y,1,'#fcd116') for x,y in [(2,3),(2,17),(12,10)])
flags['MY']=stripes(['#cc0001' if i%2==0 else '#fff' for i in range(14)])+rect(0,0,15,11.4,'#010066')+circle(6,5.7,3.4,'#ffcc00')+circle(7,5.7,2.8,'#010066')+star(11,5.7,2.3,'#ffcc00')
flags['AR']=stripes(['#74acdf','#fff','#74acdf'])+circle(15,10,1.5,'#f6b40e')
flags['CL']=stripes(['#fff','#d52b1e'])+rect(0,0,10,10,'#0039a6')+star(5,5,3,'#fff')
flags['MX']=stripes(['#006847','#fff','#ce1126'],True)+circle(15,11,2.1,'#8b6832')+path('M13 10L16 7L17 10L15 11Z','#694f2c')
flags['ZA']=rect(0,0,30,20,'#de3831')+rect(0,10,30,10,'#002395')+path('M0 0L14 8H30V12H14L0 20Z','#fff')+path('M0 2L13 8.5H30V11.5H13L0 18Z','#007a4d')+path('M0 3L11 10L0 17Z','#ffb612')+path('M0 5L8 10L0 15Z','#000')
flags['IL']=rect(0,0,30,20,'#fff')+rect(0,3,30,2,'#0038b8')+rect(0,15,30,2,'#0038b8')+'<path d="M15 6L19 12H11ZM15 14L11 8H19Z" fill="none" stroke="#0038b8" stroke-width=".65"/>'
flags['IS']=flags['IS']
flags['KZ']=rect(0,0,30,20,'#00afca')+circle(16,9,3,'#fec50c')+path('M10 14Q16 12 22 14L16 16Z','#fec50c')+rect(2,0,1,20,'#fec50c')
flags['GE']=rect(0,0,30,20,'#fff')+rect(13,0,4,20,'#ff0000')+rect(0,8,30,4,'#ff0000')+''.join(rect(x-1,y-3,2,6,'#f00')+rect(x-3,y-1,6,2,'#f00') for x,y in [(6,4),(24,4),(6,16),(24,16)])
for code,colors in {'CO':['#fcd116','#fcd116','#003893','#ce1126'],'EC':['#ffd100','#ffd100','#034ea2','#ef3340'],'VE':['#ffcc00','#0033ab','#cf142b'],'CR':['#002b7f','#fff','#ce1126','#ce1126','#fff','#002b7f'],'MM':['#fecb00','#34b233','#ea2839']}.items():flags[code]=stripes(colors)
flags['MM']+=star(15,10,7,'#fff')
flags['PA']=rect(0,0,30,20,'#fff')+rect(15,0,15,10,'#da121a')+rect(0,10,15,10,'#072357')+star(7.5,5,2.8,'#072357')+star(22.5,15,2.8,'#da121a')
flags['CU']=stripes(['#002a8f','#fff','#002a8f','#fff','#002a8f'])+path('M0 0L16 10L0 20Z','#cf142b')+star(5,10,3,'#fff')
flags['LA']=rect(0,0,30,20,'#ce1126')+rect(0,5,30,10,'#002868')+circle(15,10,4,'#fff')
for code,svg in flags.items():
    (OUT/(code.lower()+'.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">'+svg+'</svg>')
print(f'{len(flags)} offline flag icons generated')
