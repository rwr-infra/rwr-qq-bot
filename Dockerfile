# 基础依赖阶段
FROM node:24.15.0-bookworm-slim AS base

# 版本参数
ARG TAG_NAME
ENV APP_VERSION=$TAG_NAME
ENV PNPM_VERSION=10.33.0
ENV NODE_ENV=production

# 安装基础依赖
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates fontconfig; \
    rm -rf /var/lib/apt/lists/* /tmp/*; \
    npm install -g pnpm@${PNPM_VERSION}; \
    pnpm config set store-dir /root/.local/share/pnpm/store; \
    rm -rf ~/.npm

# 构建阶段
FROM base AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 使用 BuildKit 缓存优化依赖安装
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN pnpm run build \
    && pnpm prune --prod

# 运行阶段
FROM base AS runner

# 时区设置
ENV TZ=Asia/Shanghai

# 服务端口（可通过环境变量覆盖）
ENV PORT=3000
# 监听所有接口，确保 Docker 内外均可访问
ENV HOSTNAME=0.0.0.0

# 运行时特有的依赖
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        iputils-ping \
        tzdata \
        fonts-noto-color-emoji \
        fonts-noto-cjk \
        fonts-wqy-zenhei; \
    rm -rf /var/lib/apt/lists/* /tmp/*; \
    fc-cache -fv

# 设置工作目录并更改所有权
WORKDIR /app

# 复制生产依赖和资源
COPY package.json pnpm-lock.yaml ./
COPY consola.ttf ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist

# 添加元数据
LABEL maintainer="Kreedzt" \
    version=${TAG_NAME} \
    description="RWR QQ Bot" \
    org.opencontainers.image.source="https://github.com/rwr-infra/rwr-qq-bot"

# 设置健康检查（使用 PORT 环境变量）
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD node -e "const req = require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.setTimeout(2500, () => process.exit(1));"

# 声明暴露端口（默认3000，可通过环境变量 PORT 修改）
EXPOSE ${PORT}

# 设置默认命令
CMD ["node", "dist/app.js"]
