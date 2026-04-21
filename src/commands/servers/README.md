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

## maps

### 用途

根据 MAPS_DATA_FILE 提供的地图数据, 生成地图列表图片输出

### 环境变量

-   MAPS_DATA_FILE: 用于提供地图数据的 JSON 数据文件名
-   OUTPUT_BG_IMG: 将输出的图片添加背景图 layer 层, 位于底色上方

### 注册的指令

-   maps: 根据 MAPS_DATA_FILE 提供的地图数据, 生成地图列表图片输出
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
