"""Build an offline globe atlas from Natural Earth's public-domain 1:50m land."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import json, math, hashlib

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'data/ne_50m_land.geojson'
WIDTH,HEIGHT=2048,1024
data=json.loads(SOURCE.read_text())
mask=Image.new('L',(WIDTH,HEIGHT),0)
draw=ImageDraw.Draw(mask)
coasts=[]

def simplify(points,tolerance=.055):
    # Iterative Ramer-Douglas-Peucker; preserve small islands and ring endpoints.
    if len(points)<8:return points
    keep={0,len(points)-1};stack=[(0,len(points)-1)]
    while stack:
        a,b=stack.pop();ax,ay=points[a];bx,by=points[b];dx,dy=bx-ax,by-ay
        denominator=dx*dx+dy*dy
        distance=-1;index=None
        for i in range(a+1,b):
            x,y=points[i]
            t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/denominator)) if denominator else 0
            value=(x-ax-dx*t)**2+(y-ay-dy*t)**2
            if value>distance:distance=value;index=i
        if distance>tolerance*tolerance:
            keep.add(index);stack.extend([(a,index),(index,b)])
    result=[points[i] for i in sorted(keep)]
    return result if len(result)>=4 else points

for feature in data['features']:
    geometry=feature['geometry']
    polygons=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
    for polygon in polygons:
        for index,ring in enumerate(polygon):
            points=[((lng+180)/360*(WIDTH-1),(90-lat)/180*(HEIGHT-1)) for lng,lat in ring]
            draw.polygon(points,fill=255 if index==0 else 0)
            if len(ring)>3:
                simplified=simplify(ring)
                coasts.append([[round(lng,4),round(lat,4)] for lng,lat in simplified])

# Atlas channels: red = land, green = softened coastline, blue = fine land ink.
outer=mask.filter(ImageFilter.MaxFilter(3));inner=mask.filter(ImageFilter.MinFilter(3))
shore=ImageChops.subtract(outer,inner).filter(ImageFilter.GaussianBlur(.65))
ink=Image.new('L',(WIDTH,HEIGHT),0)
ink_draw=ImageDraw.Draw(ink)
for y in range(3,HEIGHT,8):
    for x in range(3,WIDTH,8):
        if mask.getpixel((x,y))>127:
            ink_draw.point((x,y),fill=70)
ink=ink.filter(ImageFilter.GaussianBlur(.45))
atlas=Image.merge('RGB',(mask,shore,ink))
atlas.save(ROOT/'dist/assets/earth-atlas.webp',lossless=True,method=6)
payload={'source':'Natural Earth 1:50m land · public domain','coasts':coasts}
(ROOT/'dist/earth-data.js').write_text('/* Made with Natural Earth. See ASSETS.md. */\nwindow.MikuEarth='+json.dumps(payload,separators=(',',':'),ensure_ascii=False)+';\n')
(ROOT/'data/README.md').write_text('''# Globe source data

`ne_50m_land.geojson` is Natural Earth 1:50m land, obtained from the project's
official source repository:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson

Natural Earth data is public domain:
https://www.naturalearthdata.com/about/terms-of-use/

Only physical land/coastline geometry is used; no administrative boundary layer.
`python scripts/build_earth.py` produces the local 2048×1024 land/coast/ink atlas
and simplified coastlines for compatible rendering. Blue ink is decorative;
it does not encode population, city brightness or measured terrain.

Source SHA-256: '''+hashlib.sha256(SOURCE.read_bytes()).hexdigest()+'\n')
print(json.dumps({'atlas_bytes':(ROOT/'dist/assets/earth-atlas.webp').stat().st_size,'rings':len(coasts),'vertices':sum(map(len,coasts))}))
