# 图像与图标

三张背景来自本次任务中用户提供的图片。源图未被覆盖，主题使用保持画面内容的 WebP 编码版本与缩略图，不引用外部图床。

| 源文件 | 主题资源 | 名称 |
| --- | --- | --- |
| `Image_303301030074457.png` | `assets/daydream.webp` | 晴空初音 |
| `Image_303246521448531.png` | `assets/wonderland.webp` | 甜梦游园 |
| `Image_303321884330689.png` | `assets/starlight.webp` | 星光舞台 |

`assets/miku.webp` 是通过内置 imagegen 绘图工具生成的透明背景萌版初音，缩放与编码后用于主题。生成原图为 `generated_images/exec-80254cf9-c152-4070-bdf2-4e540c05fb33.png`；主题资源的透明通道已保留。

生成提示词：

> Use case: stylized-concept. Asset type: small transparent mascot for a Hatsune Miku server-monitor dashboard. Primary request: one adorable polished chibi Hatsune Miku, full body, big turquoise twin tails, large expressive teal eyes, recognizable gray sleeveless top, teal tie, black detached sleeves and skirt with teal trim, black thigh boots and tiny magenta headset details. She is cheerfully sitting on a small dark navy server cube with one subtle glowing teal indicator, legs dangling, holding a tiny teal music note. Style: premium Japanese anime sticker illustration, crisp clean linework, refined soft cel shading, simple silhouette legible at 110px, sweet joyful expression. Composition: portrait central isolated character, all hair and feet fully in frame with generous transparent margin. Actual transparent alpha background. No backdrop, no text, no watermark, no sticker border, no extra characters, no UI screenshot. Approximate color palette turquoise #39c5bb, navy #102939, small magenta #ec5a98. This is a standalone raster project asset, not a wallpaper.

`dist/app.js` 中的功能图标为源码内联 SVG；`dist/assets/favicon.svg` 为青绿音符图案。图表及采样音轨由实际数值生成 SVG，没有使用绘图模型生成监控数据或曲线。

主题管理器中的预览图是第一张壁纸的缩略图，是封面插画，不是经过浏览器截图的界面。代码的 MIT 许可证不改变用户提供插画或角色形象的既有权利。

## v1.1.0 新增资源

本次使用内置 imagegen 绘图工具，以原 `assets/miku.webp` 作为风格参考，分别生成三只全新的透明初音伙伴。ImageMagick 仅作等比例缩放及 WebP 编码，保留 alpha；原款未覆盖。

| 文件 | 形象 | 生成原图 |
| --- | --- | --- |
| `dist/assets/miku-leek.webp` | 葱葱日常：薄荷绿连帽衫、葱、坐在服务器上 | `exec-18eec4d7-61df-4b15-9b70-96422ce8584c.png` |
| `dist/assets/miku-orbit.webp` | 星航宇宙：白色宇航夹克、抱着小星球 | `exec-d1b39c4d-12c1-41f5-b180-3f082605abf1.png` |
| `dist/assets/miku-song.webp` | 应援歌姬：经典服装、麦克风、粉青音符 | `exec-ebd17742-0875-4ef4-9583-cbdba7878372.png` |

共同生成提示：Use case: stylized-concept. One transparent chibi Hatsune Miku mascot for a Komari monitor theme; reference only for style and proportions. Oversized turquoise twin tails, expressive teal eyes, polished Japanese anime sticker style, crisp linework and soft cel shading, sitting on a navy server cube. Full body, all hair and feet visible, generous transparent margin, legible at 120px. Palette turquoise #39c5bb, navy #102939, magenta #ec5a98. Actual transparent alpha, no backdrop, text, watermark, sticker border or additional characters.

变体提示：

- 葱葱：oversized mint-green hoodie, black pleated skirt, teal boots, magenta headset, sitting cross-legged, happily holding a leek, cheerful wink。
- 星航：white and navy futuristic astronaut jacket, teal boots, magenta headset, visible twin tails, holding a small blue-green planet, curious sparkling eyes, no glass helmet。
- 应援：gray sleeveless top, teal tie, black detached sleeves and skirt, magenta headset, sitting sideways, small microphone, floating pink and teal notes, joyful singing expression。

69 个 `dist/assets/flags/*.svg` 是本次用矢量代码绘制的地区识别图标，小尺寸徽章和细节有简化。未使用外部国旗图床。服务器及汇聚区域坐标是实际坐标或注明的代表点，不用于行政边界判定。

上述新文件完整随安装包交付；生成原图由绘图工具作为本次图片输出保存。源码中的图标位于 `dist/app.js`，本安装包未包含旧 README 所述的单独 src 目录。

## v1.3.0 地球资源

地球陆地与海岸来自 [Natural Earth 官方源仓库的 1:50m land 数据](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson)。[Natural Earth 许可说明](https://www.naturalearthdata.com/about/terms-of-use/)将数据置于公有领域。原始数据和 SHA-256 校验值随包放在 `data/` 中；只使用物理陆地几何，没有行政边界图层。

`scripts/build_earth.py` 将源几何生成 `dist/assets/earth-atlas.webp`（2048×1024，无损 RGB）和 `dist/earth-data.js`（兼容模式海岸线）。纹理红通道为陆地覆盖、绿通道为柔化海岸、蓝通道为装饰性陆地纹理。蓝通道不代表人口、城市灯光或实测地形。舞台光照、海面高光、大气辉光及流光均由本地代码绘制，没有外部纹理请求。

音乐音轨、峰顶和断拍使用代码生成的 SVG/CSS；音量柱实际表示监控采样峰值，不包含音频测量或音频播放。

v1.4 的服务器位置图标、聚合数量、名称和状态描边由 Canvas 代码绘制，沿用原海岸纹理，没有新增外部图片或位置查询请求。
