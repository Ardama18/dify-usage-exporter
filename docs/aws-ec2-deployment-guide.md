# AWS EC2 Docker デプロイメントガイド

## 概要

本ドキュメントは、**既存の Dify が動作している AWS EC2 インスタンス**に dify-usage-exporter を追加デプロイする手順を説明します。

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│  AWS EC2 インスタンス                                        │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │     Dify        │    │    dify-usage-exporter          │ │
│  │   (Docker)      │◄───│         (Docker)                │ │
│  │                 │    │                                 │ │
│  │  localhost:80   │    │  - Dify からデータ取得          │ │
│  └─────────────────┘    │  - API_Meter へ送信             │ │
│                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTPS
                    ┌───────────────────────────────┐
                    │  API_Meter (Vercel)           │
                    │  v0-cloud-api-meter.vercel.app│
                    └───────────────────────────────┘
```

### 接続情報

| サービス | URL | 備考 |
|----------|-----|------|
| Dify | `http://localhost` または `http://host.docker.internal` | EC2 内部アクセス |
| API_Meter ダッシュボード | https://v0-cloud-api-meter.vercel.app/dashboard | 外部サービス |
| API_Meter エンドポイント | https://v0-cloud-api-meter.vercel.app/api/integrations/dify/usage-data/receive | データ送信先 |

---

## 1. 前提条件

### 1.1 既存環境の確認

EC2 に SSH 接続して以下を確認:

```bash
# Docker が動作していることを確認
docker --version
docker compose version

# Dify コンテナが動作していることを確認
docker ps | grep -i dify
```

### 1.2 Dify への接続確認

```bash
# Dify が localhost でアクセス可能か確認
curl -I http://localhost
# または
curl -I http://localhost:80
```

---

## 2. Exporter のデプロイ

### 2.1 リポジトリのクローン

```bash
# 作業ディレクトリ作成
mkdir -p ~/apps
cd ~/apps

# リポジトリをクローン
git clone https://github.com/Ardama18/dify-usage-exporter.git
cd dify-usage-exporter
```

### 2.2 環境変数の設定

```bash
# .env ファイルを作成
cp .env.example .env

# エディタで編集
nano .env
```

**.env ファイルの設定内容:**

```bash
# ============================================
# Dify API 接続情報（同一EC2内のDify）
# ============================================
# Docker コンテナから EC2 ホストの Dify にアクセス
DIFY_API_BASE_URL=http://host.docker.internal

# Dify の管理者アカウント
DIFY_EMAIL=your-dify-admin-email@example.com
DIFY_PASSWORD=your-dify-admin-password

# ============================================
# API_Meter 接続情報（Vercel）
# ============================================
EXTERNAL_API_URL=https://v0-cloud-api-meter.vercel.app/api/integrations/dify/usage-data/receive
EXTERNAL_API_TOKEN=your-api-meter-bearer-token
API_METER_TENANT_ID=your-tenant-uuid

# ============================================
# スケジュール設定（UTC）
# ============================================
# 毎日 AM 1:00 JST = UTC 16:00
CRON_SCHEDULE=0 16 * * *

# ============================================
# 取得期間設定
# ============================================
# today / yesterday / current_month / last_month
DIFY_FETCH_PERIOD=current_month

# ============================================
# オプション設定
# ============================================
LOG_LEVEL=info
NODE_ENV=production
MAX_RETRY=3
```

> **重要**:
> - `DIFY_API_BASE_URL=http://host.docker.internal` は Docker コンテナから EC2 ホストにアクセスするための特殊なホスト名です
> - `CRON_SCHEDULE` は **UTC** で設定します（JST -9時間）

### 2.3 docker-compose.yml の確認

既存の `docker-compose.yml` に `extra_hosts` 設定があることを確認:

```yaml
services:
  dify-usage-exporter:
    # ...
    extra_hosts:
      - "host.docker.internal:host-gateway"  # ← この設定が必要
```

---

## 3. 起動とテスト

### 3.1 イメージのビルド

```bash
cd ~/apps/dify-usage-exporter

# イメージをビルド
docker compose build
```

### 3.2 手動実行でテスト

まずスケジュール起動せずに手動でテストします:

```bash
# 一回限りの実行でテスト
docker compose run --rm dify-usage-exporter node dist/index.js
```

**成功時の出力例:**

```
{"level":"info","message":"実行開始",...}
{"level":"info","message":"Difyログイン成功",...}
{"level":"info","message":"アプリ一覧取得完了","count":4,...}
{"level":"info","message":"外部API送信完了","status":200,...}
```

### 3.3 API_Meter ダッシュボードで確認

ブラウザで https://v0-cloud-api-meter.vercel.app/dashboard にアクセスし、データが送信されていることを確認します。

### 3.4 コンテナの起動（スケジュール実行）

テストが成功したら、バックグラウンドで起動:

```bash
# バックグラウンドで起動
docker compose up -d

# 起動状態を確認
docker compose ps

# ログを確認
docker compose logs -f
```

---

## 4. 運用コマンド

### 4.1 基本操作

```bash
cd ~/apps/dify-usage-exporter

# ステータス確認
docker compose ps

# ログ確認（リアルタイム）
docker compose logs -f

# ログ確認（直近100行）
docker compose logs --tail=100

# 再起動
docker compose restart

# 停止
docker compose stop

# 完全停止・削除
docker compose down
```

### 4.2 手動でデータ送信

スケジュール外で即時実行したい場合:

```bash
# 実行中のコンテナ内で実行
docker compose exec dify-usage-exporter node dist/index.js

# または新しいコンテナで実行
docker compose run --rm dify-usage-exporter node dist/index.js
```

### 4.3 CLI コマンド

```bash
# 失敗ファイル一覧
docker compose exec dify-usage-exporter node dist/cli/index.js list

# ヘルプ
docker compose exec dify-usage-exporter node dist/cli/index.js --help
```

---

## 5. トラブルシューティング

### 5.1 Dify に接続できない

**エラー:** `connect ECONNREFUSED` または `ETIMEDOUT`

```bash
# コンテナ内から Dify への接続テスト
docker compose run --rm dify-usage-exporter sh -c 'wget -q --spider http://host.docker.internal && echo "OK" || echo "NG"'
```

**対処法:**
1. Dify コンテナが起動しているか確認: `docker ps | grep dify`
2. Dify のポートを確認: `curl http://localhost:80`
3. `extra_hosts` 設定を確認

### 5.2 Dify ログイン失敗

**エラー:** `401 Unauthorized` または `Invalid credentials`

**対処法:**
1. `.env` の `DIFY_EMAIL` と `DIFY_PASSWORD` を確認
2. Dify 管理画面でログインできるか確認
3. パスワードに特殊文字がある場合はクォートで囲む

### 5.3 API_Meter 送信エラー

**エラー:** `401 AUTH_TOKEN_INVALID`

**対処法:**
1. `EXTERNAL_API_TOKEN` が正しいか確認
2. `API_METER_TENANT_ID` が正しい UUID 形式か確認

```bash
# 設定値を確認
docker compose exec dify-usage-exporter printenv | grep -E "(EXTERNAL_API|API_METER)"
```

### 5.4 スケジュールが動作しない

```bash
# Cron 設定を確認
docker compose exec dify-usage-exporter printenv | grep CRON

# コンテナの時刻を確認（UTC）
docker compose exec dify-usage-exporter date
```

---

## 6. アップデート手順

```bash
cd ~/apps/dify-usage-exporter

# 最新コードを取得
git pull origin main

# コンテナを停止
docker compose down

# イメージを再ビルド
docker compose build --no-cache

# コンテナを起動
docker compose up -d

# ログで正常起動を確認
docker compose logs -f
```

---

## 7. Dify ネットワークへの参加（オプション）

Dify と同じ Docker ネットワークで動作させる場合:

### 7.1 Dify のネットワーク名を確認

```bash
# Dify コンテナのネットワークを確認
docker inspect $(docker ps -q --filter name=dify) --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

### 7.2 docker-compose.yml を修正

```yaml
services:
  dify-usage-exporter:
    # ... 既存の設定 ...
    networks:
      - dify_default  # Dify のネットワーク名に合わせる
    environment:
      - DIFY_API_BASE_URL=http://nginx  # Dify の nginx コンテナ名

networks:
  dify_default:
    external: true
```

---

## 付録

### A. クイックスタート

```bash
# デプロイ
cd ~/apps
git clone https://github.com/Ardama18/dify-usage-exporter.git
cd dify-usage-exporter
cp .env.example .env
nano .env  # 環境変数を設定

# テスト実行
docker compose build
docker compose run --rm dify-usage-exporter node dist/index.js

# スケジュール起動
docker compose up -d
```

### B. 環境変数一覧

| 変数名 | 必須 | 設定例 | 説明 |
|--------|------|--------|------|
| DIFY_API_BASE_URL | ○ | `http://host.docker.internal` | Dify API URL |
| DIFY_EMAIL | ○ | `admin@example.com` | Dify 管理者メール |
| DIFY_PASSWORD | ○ | `your-password` | Dify パスワード |
| EXTERNAL_API_URL | ○ | `https://v0-cloud-api-meter.vercel.app/api/integrations/dify/usage-data/receive` | API_Meter エンドポイント |
| EXTERNAL_API_TOKEN | ○ | `Bearer-token` | API_Meter 認証トークン |
| API_METER_TENANT_ID | ○ | `uuid-format` | テナント ID |
| CRON_SCHEDULE | - | `0 16 * * *` | 実行スケジュール (UTC) |
| DIFY_FETCH_PERIOD | - | `current_month` | 取得期間 |
| LOG_LEVEL | - | `info` | ログレベル |

### C. Cron スケジュール例（UTC）

| JST | UTC (CRON_SCHEDULE) |
|-----|---------------------|
| 毎日 AM 1:00 | `0 16 * * *` |
| 毎日 AM 6:00 | `0 21 * * *` |
| 毎日 AM 9:00 | `0 0 * * *` |
| 毎月 1日 AM 0:00 | `0 15 1 * *` |
