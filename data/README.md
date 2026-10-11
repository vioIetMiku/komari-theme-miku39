# Globe source data

`ne_50m_land.geojson` is Natural Earth 1:50m land, obtained from the project's
official source repository:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson

Natural Earth data is public domain:
https://www.naturalearthdata.com/about/terms-of-use/

Only physical land/coastline geometry is used; no administrative boundary layer.
`python scripts/build_earth.py` produces the local 2048×1024 land/coast/ink atlas
and simplified coastlines for compatible rendering. Blue ink is decorative;
it does not encode population, city brightness or measured terrain.

Source SHA-256: e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b
