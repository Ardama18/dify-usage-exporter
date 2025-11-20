---
story_id: "1"
title: foundation-and-scheduler
feature: docker
task_number: "008"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: Docker対応

メタ情報:
- 依存: task-007 → 成果物: src/index.ts
- 提供: Dockerfile, .dockerignore
- サイズ: 小規模（2ファイル）

## 実装内容

Dockerマルチステージビルドを設定し、本番用の軽量イメージを作成する。node:20-alpineベース、非rootユーザー（exporter）での実行、本番依存のみインストールを実現。

## 対象ファイル

- [ ] Dockerfile
- [ ] .dockerignore

## 実装手順

### 1. Dockerfile作成

- [ ] マルチステージビルドのDockerfile作成（Design Doc準拠）
  ```dockerfile
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
  ```

### 2. .dockerignore作成

- [ ] .dockerignore作成
  ```
  node_modules
  dist
  .git
  .gitignore
  .env
  .env.*
  !.env.example
  coverage
  test
  *.md
  !README.md
  .vscode
  .idea
  ```

### 3. ビルド確認

- [ ] docker build コマンドで成功確認
  ```bash
  docker build -t dify-usage-exporter .
  ```
- [ ] イメージサイズ確認
  ```bash
  docker images dify-usage-exporter
  ```

### 4. 起動確認

- [ ] docker run で起動確認
  ```bash
  docker run --env-file .env dify-usage-exporter
  ```
- [ ] ログ出力確認
- [ ] 非rootユーザー確認
  ```bash
  docker run --rm dify-usage-exporter whoami
  # 出力: exporter
  ```

## 完了条件

- [ ] AC-DOCKER-1: マルチステージビルドでDockerイメージを構築
- [ ] AC-DOCKER-2: 非rootユーザー（exporter）でコンテナを実行
- [ ] AC-DOCKER-3: node:20-alpineベースイメージを使用
- [ ] TypeScript strict mode: エラー0件（Dockerfileに型はないが、ビルド成功を確認）
- [ ] Biome lint: エラー0件（Dockerfileに対するlintは対象外）
- [ ] 動作確認完了（L2: Docker build/run成功）
  ```bash
  docker build -t dify-usage-exporter . && \
  docker run --rm --env-file .env dify-usage-exporter
  ```
- [ ] ビルドイメージサイズの最適化（alpine + 本番依存のみ）

## 注意事項

- **影響範囲**: 本番デプロイ環境
- **制約**: Design Docのインターフェースに完全準拠
- **セキュリティ**: 非rootユーザー（uid:1001）で実行
- **最適化**:
  - マルチステージビルドでビルドツールを除外
  - npm ci --only=production で本番依存のみ
  - npm cache clean --force でキャッシュ削除
- **.env必須**: docker runには--env-fileまたは-eで環境変数を渡す必要あり
