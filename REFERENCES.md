# 参考项目与官方接口

- [Komari 官方 API 文档](https://komari-document.pages.dev/dev/api)：核对公开服务器、Ping 任务、Ping 历史及请求驱动的实时 WebSocket 数据结构。新增卡片采样沿用这些同源公开接口。
- [Komari 官方前端](https://github.com/komari-monitor/komari-web)：主题与服务器前端的对应关系和主题安装结构。
- [Komari-Next](https://github.com/tonyliuzj/komari-next)：参考首页 Ping 统计、地图、卡片模糊与透明度独立调节的交互组织。
- [Globe.GL](https://globe.gl/) / [源码项目](https://github.com/vasturiano/globe.gl) / [three-globe](https://github.com/vasturiano/three-globe)：参考三维球面的连接弧线、粒子方向、自动旋转与交互组织。本主题使用独立的 WebGL 着色器与 Canvas 流光/兼容绘制，没有加载 Globe.GL、Three.js 或 CDN。

本次没有复制上述项目的 JavaScript 代码或引入第三方 JavaScript 运行时依赖。国旗图标由本地矢量代码生成；地球物理地理数据与插画来源见 `ASSETS.md`。

- [国务院港澳事务办公室驻香港联络办公室：中华人民共和国行政区划](https://www.zlb.gov.cn/2014-01/04/c_125956269.htm)：核对 34 个省级行政区的分类。主题坐标仅为地区代表点，不是行政边界。

## v1.3 高清地球与渲染生命周期

- [Natural Earth](https://www.naturalearthdata.com/) / [官方 land 源数据](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_land.geojson) / [公有领域许可说明](https://www.naturalearthdata.com/about/terms-of-use/)：使用 1:50m 物理陆地几何生成本地海岸纹理，替代旧版手绘粗略轮廓。原数据、校验值和生成方法随包交付。
- [MDN：webglcontextlost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event) / [Khronos：Handling Context Lost](https://wikis.khronos.org/webgl/HandlingContextLost)：核对上下文丢失、恢复与资源重建。主题丢失 GPU 上下文时切换兼容绘制，恢复时重建纹理、程序和缓冲区。

延迟与丢包音轨采用本地时间分箱和真实峰值；舞台灯光和装饰游标不作为监控测量。

## v1.4 历史、流量与服务器信息

- [Komari 官方记录模型](https://github.com/komari-monitor/komari/blob/main/database/models/models.go)与[历史兼容记录重构](https://github.com/komari-monitor/komari/blob/main/internal/metricstore/legacy_records.go)：核对 `ram` / `disk` 的字节用量、`ram_total` / `disk_total` 以及重构时容量可能保留零值的情况。主题使用有效容量回退，不更改历史采样。
- [Komari 官方 API 文档](https://komari-document.pages.dev/dev/api)：核对公开服务器信息中的价格、币种、计费周期、到期、流量配额和最近上报中的累计计数；主题仅沿用公开同源接口。

没有调用管理员接口补造费用或查询外部 IP 地理位置。地图按已有坐标或标明的代表点显示服务器，位置与在线流光分别处理。
