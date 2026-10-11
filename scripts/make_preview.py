from pathlib import Path
import base64, json, re
ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'dist'
OUT=ROOT.parent/'output'
OUT.mkdir(exist_ok=True)
assets={}
for p in (DIST/'assets').rglob('*'):
 if p.is_file():
  mime={'.svg':'image/svg+xml','.webp':'image/webp'}[p.suffix]
  assets[p.relative_to(DIST/'assets').as_posix()]='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
css=(DIST/'styles.css').read_text().replace("url('./assets/daydream.webp')",'url("'+assets['daydream.webp']+'")')
js='\n'.join((DIST/p).read_text() for p in ['dom.js','destinations.js','regions.js','earth-data.js','earth-renderer.js','globe.js','music.js','backgrounds.js','app.js'])
html='''<!doctype html><html lang="zh-CN" data-appearance="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>Miku39 v1.4.4 · 交互演示</title><link rel="icon" href="'''+assets['favicon.svg']+'''"><style>'''+css+'''</style></head><body><a href="#main" class="skip-link">跳到服务器监控</a><div class="wallpaper" aria-hidden="true"></div><div id="app" class="km-layout"></div><div id="toast" role="status" aria-live="polite"></div><script>window.MIKU39_DEMO=true;window.MIKU39_ASSETS='''+json.dumps(assets)+''';</script><script>'''+js.replace('</script','<\\/script')+'''</script><noscript>请启用 JavaScript 查看交互演示。</noscript></body></html>'''
path=OUT/'miku39-v1.4.4-preview.html';path.write_text(html)
print(path.resolve(),path.stat().st_size)
