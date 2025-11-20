# ビルドステージ
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# 実行ステージ
FROM node:20-alpine AS runner

WORKDIR /app

# 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S exporter -u 1001 -G nodejs

# 必要なファイルのみコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 本番用依存のみインストール
RUN npm ci --only=production && \
    npm cache clean --force

# 非rootユーザーに切り替え
USER exporter

CMD ["node", "dist/index.js"]
