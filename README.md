# RWR Imba QQ 机器人

[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Kreedzt_rwr-imba-qq-bot&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Kreedzt_rwr-imba-qq-bot)
[![codecov](https://codecov.io/gh/Kreedzt/rwr-imba-qq-bot/branch/master/graph/badge.svg?token=MWGXZH7GO9)](https://codecov.io/gh/Kreedzt/rwr-imba-qq-bot)
![build status](https://github.com/Kreedzt/rwr-imba-qq-bot/actions/workflows/ci.yml/badge.svg?branch=master)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FKreedzt%2Frwr-imba-qq-bot.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FKreedzt%2Frwr-imba-qq-bot?ref=badge_shield)
[![Docker Image Size](https://badgen.net/docker/size/zhaozisong0/rwr-imba-qq-bot?icon=docker&label=image%20size)](https://hub.docker.com/r/zhaozisong0/rwr-imba-qq-bot/)

## 环境变量

通用配置:

- PORT: 监听的 HTTP 端口号, 类型为 `number`, 默认值为 `3000`, eg: `6768`
- REMOTE_URL: go-cqhttp 的服务监听的 HTTP 地址, 类型为 `string`, eg: `http://127.0.0.1:5701`
- START_MATCH: 机器人命令触发前缀, 类型为 `string`, eg: `#`
- ADMIN_QQ_LIST: 管理员 QQ 列表, 类型为 `string[]`, eg: `555555`
- LISTEN_GROUP: 监听的 QQ 群号, 类型为 `number`, eg: `111111`
- ACTIVE_COMMANDS: 激活的命令列表, 类型为 `JSON string[]`, eg: `["fuck", "roll", "tdoll"]`
- IMGPROXY_URL: imgproxy 图片代理地址, 用于图片裁剪宽高及缩放
- WELCOME_TEMPLATE: TODO

命令配置:

- SERVERS_MATCH_REGEX: RWR 服务器筛选正则表达式, 类型为 `string`
- SERVERS_FALLBACK_URL: 无法匹配服务器时的备用 URL
- WEBSITE_DATA_FILE: 指定的网站文件路径
- TDOLL_DATA_FILE: 战术人形数据文件路径
- TDOLL_SKIN_DATA_FILE: 战术人形皮肤数据文件路径
- MAPS_DATA_FILE: 地图数据文件路径
- QA_DATA_FILE: 自助问答数据文件路径
- DIFY_AI_URL: DIFY AI 请求 URL (包含 `/chat-messages`)
- DIFY_AI_TOKEN: DIFY AI 请求 Token
- PG_HOST: PostgreSQL 数据库Host地址, 用于统计命令数据 (默认: localhost)
- PG_PORT: PostgreSQL 数据库端口 (默认: 5432)
- PG_DB: PostgreSQL 数据库名, 用于统计命令数据
- PG_USER: PostgreSQL 用户名, 用于统计命令数据
- PG_PASSWORD: PostgreSQL 密码, 用于统计命令数据
- OUTPUT_BG_IMG: 背景图片路径, 用于 canvas 渲染时添加背景层
- MODERATORS: 服务器管理员玩家名列表, 类型为 `JSON string[]`, eg: `["KREEDZT"]`。用于 `players` 命令中高亮显示管理员
- MODERATOR_BADGE: 管理员标识字符, 类型为 `string`, 默认值为 `★`, eg: `⭐`

## 命令列表

各命令详细文档位于 `src/commands/<name>/README.md`

| 命令 | 说明 | 管理员 | 示例 |
|------|------|--------|------|
| website | 网站列表查询 | 否 | `#website` |
| servers | 服务器信息 (图片) | 否 | `#servers` |
| whereis / w | 玩家所在服务器 | 否 | `#whereis player1` |
| analytics / a | 服务器玩家统计 | 否 | `#analytics d` |
| maps / m | 地图列表 | 否 | `#maps` |
| players / p | 服务器玩家列表 | 否 | `#players` |
| tdoll / td | 人形数据查询 | 否 | `#tdoll M4A1` |
| tdollskin / ts | 人形皮肤查询 | 否 | `#tdollskin 3` |
| qa | 自定义问答 | 否 | `#qa 你好` |
| qadefine | 添加问答 | 是 | `#qadefine Q A` |
| qadelete | 删除问答 | 是 | `#qadelete Q` |
| ai | AI 智能问答 | 否 | `#ai 你好` |
| log | 命令使用日志 | 否 | `#log tdoll` |
| logself / ls | 自己的命令日志 | 否 | `#logself` |
| log7 | 近 7 天命令日志 | 否 | `#log7` |
| 1pt | 短链接生成 | 否 | `#1pt https://...` |
| check / c | 网络连通性检查 | 否 | `#check` |
| roll / r | 随机数生成 | 否 | `#roll 1 100` |
| neko | Neko 图片 | 否 | `#neko` |
| waifu | Waifu 图片 | 否 | `#waifu` |
| touhou | 东方 Project 图片 | 否 | `#touhou` |
| setu | 随机涩图 | 否 | `#setu` |
| version / v | 机器人版本 | 是 | `#version` |
| fuck | 重启 Bot | 是 | `#fuck` |

## 部署

### Docker

可选挂载目录

- logs: 日志输出目录

```sh
docker run --name my-rwr-qq-bot \
-p 3000:3000 \
-e "PORT=3000" \
-e "REMOTE_URL=<REMOTE_URL>" \
-e "START_MATCH=<START_MATCH>" \
-e "ADMIN_QQ_LIST=<ADMIN_QQ_LIST>" \
-e "LISTEN_GROUP=<LISTEN_GROUP>" \
-e "ACTIVE_COMMANDS=<ACTIVE_COMMANDS>" \
-e "SERVER_MATCH_REGEX=<SERVER_MATCH_REGEX>" \
-v ${PWD}/data:/app/data \
-v ${PWD}/logs:/app/logs \
-d zhaozisong0/rwr-imba-qq-bot:latest
```

> **提示**: PORT 默认值为 `3000`，如需修改端口，请同时调整 `-p` 映射和 `-e PORT` 环境变量。例如使用 8080 端口：`-p 8080:8080 -e "PORT=8080"`

### Docker compose

参考 `docker-compose-example.yaml` 文件

## 图像渲染

- 项目图片生成依赖使用 `skia-canvas`（替代 `canvas`/node-canvas），以提升 CI 与本地安装稳定性。
- 图片回归样例（用于验证迁移后输出可用）：

```sh
pnpm run test:image
```

## License

- [MIT](https://opensource.org/licenses/MIT)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FKreedzt%2Frwr-imba-qq-bot.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FKreedzt%2Frwr-imba-qq-bot?ref=badge_large)
