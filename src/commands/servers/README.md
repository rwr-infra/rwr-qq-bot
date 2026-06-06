# 服务器相关命令

## servers

### 用途

根据 SERVERS_MATCH_REGEX 筛选服务器, 查询服务器信息并生成图片输出

### 环境变量

-   SERVERS_MATCH_REGEX: 用于匹配服务器的正则表达式，用于 `servers` 命令的过滤
-   OUTPUT_BG_IMG: 将输出的图片添加背景图 layer 层, 位于底色上方

### 注册的指令

-   servers: 根据 SERVERS_MATCH_REGEX 筛选服务器, 查询服务器信息并生成图片输出
-   s: servers 的别名

## whereis

### 用途

根据 SERVERS_MATCH_REGEX 筛选服务器, 寻找玩家所在服务器并生成图片输出

### 环境变量

-   SERVERS_MATCH_REGEX: 用于匹配服务器的正则表达式，用于 `whereis` 命令的过滤
-   SERVERS_FALLBACK_URL: 用于当 SERVERS_MATCH_REGEX 无法匹配到服务器时, 呈现的备用 URL
-   OUTPUT_BG_IMG: 将输出的图片添加背景图 layer 层, 位于底色上方

### 注册的指令

-   whereis: 查询玩家所在服务器(根据 `SERVERS_MATCH_REGEX` 过滤)并生成图片输出
-   w: whereis 的别名

## analytics

### 用途

根据 SERVERS_MATCH_REGEX 筛选服务器, 查询服务器玩家统计信息并生成图片输出

### 环境变量

-   SERVERS_MATCH_REGEX: 用于匹配服务器的正则表达式，用于 `analytics` 命令的过滤

### 注册的指令

-   analytics: 根据 SERVERS_MATCH_REGEX 筛选服务器, 查询服务器玩家统计信息并生成图片输出, 支持多种参数
    -   参数 d: 查询近 7 天的数据
    -   参数 h: 查询近 24 小时的数据
-   a: analytics 的别名

## overview

### 用途

根据 SERVERS_MATCH_REGEX 筛选服务器, 生成一张卡片式三段布局的状态总览图片，与 `analytics`（时间序列折线图）形成差异化互补：

-   段一·概览: 标题 + 4 张 KPI 卡片（在线服务器数 / 在线玩家·容量·占用率 / 总 Bots / 满员服务器）+ 近24小时在线趋势折线图（面积+折线+峰值点，右上标注 24h/7日峰值数字；数据缺失时自动隐藏）
-   段二·服务器详情: 各服务器一行（斑马纹卡片）——服务器名、地图、玩家数（着色）、Bots 数、延迟（ICMP ping，着色：<80ms 绿 / <180ms 琥珀 / 更高红 / 超时灰）、地图时长
-   段三·页脚: 渲染耗时与时间

底色与 `servers`、`players` 一致（`#451a03`），可通过 `OUTPUT_BG_IMG` 叠加背景图层。

### 数据来源

-   实时快照: `queryAllServers`（聚合 KPI 与各服务器详情）
-   服务器延迟: 对各服务器 `address` 并发 ICMP `ping`（逻辑参考 `check` 命令，见 `utils/ping.ts`）。需运行环境具备 `ping` 命令
-   地图运行时长: `serverHistoryCache.getMapStartedAt` + `formatMapDuration`
-   24小时 / 7日峰值趋势: 读取 `out/analysis_hours.json` / `out/analysis.json`（由 `AnalysticsHoursTask` / `AnalysticsTask` cron 写入）。文件缺失时趋势条自动隐藏

> 该命令 `init()` 会幂等启动 `AnalysticsTask` / `AnalysticsHoursTask`，因此即便 `ACTIVE_COMMANDS` 未启用 `analytics`，总览仍能获得历史峰值趋势数据。

### 环境变量

-   SERVERS_MATCH_REGEX: 用于匹配服务器的正则表达式
-   OUTPUT_BG_IMG: 将输出的图片添加背景图 layer 层, 位于底色上方

### 注册的指令

-   overview: 生成服务器状态总览图片.[15s CD]
-   o: overview 的别名

## maps

### 用途

根据 MAPS_DATA_FILE 提供的地图数据, 生成地图列表图片输出。支持查询指定地图详情（服务器列表 + 地图缩略图）。

### 环境变量

-   MAPS_DATA_FILE: 用于提供地图数据的 JSON 数据文件名, 格式 `[{ "id": "map105", "name": "Map Name" }]`
-   MAP_IMAGE_CONFIG_FILE: 地图图片配置文件路径, 格式 `{ "images": [{ "path": "media/.../map105", "image": "url" }] }`, 可通过 `scripts/syncMapImages.js` 从远程端点同步生成
-   MAP_IMAGE_BASE_URL: 无配置匹配时的兜底图片 URL 前缀, 拼接方式为 `<BASE_URL><shortName>.png`
-   OUTPUT_BG_IMG: 将输出的图片添加背景图 layer 层, 位于底色上方

### 注册的指令

-   maps: 根据 MAPS_DATA_FILE 提供的地图数据, 生成地图列表图片输出
    -   无参数: 生成完整地图列表图片
    -   带参数 (如 `#maps map105`): 查询指定地图详情, 输出包含服务器列表图片和地图缩略图
-   m: maps 的别名

## players

### 用途

根据 SERVERS_MATCH_REGEX 筛选服务器, 查询服务器玩家列表并生成图片输出

### 环境变量

-   SERVERS_MATCH_REGEX: 用于匹配服务器的正则表达式，用于 `players` 命令的过滤
-   OUTPUT_BG_IMG: 将输出的图片添加背景图 layer 层, 位于底色上方
-   MODERATORS: 服务器管理员玩家名列表, 类型为 `JSON string[]`, eg: `["KREEDZT"]`。匹配时忽略大小写, 匹配成功的玩家名后会追加标识
-   MODERATOR_BADGE: 管理员标识字符, 默认值为 `★` (Unicode 基础星形, 兼容 Linux 无 emoji 字体环境)。如在 macOS 或已安装 `fonts-noto-color-emoji` 的 Debian 服务器上, 可设为 `⭐` 获得彩色效果

### 注册的指令

-   players: 根据 SERVERS_MATCH_REGEX 筛选服务器, 查询服务器玩家列表并生成图片输出
-   p: players 的别名
