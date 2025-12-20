# AWS EC2 Docker デプロイメントガイド

## 概要

本ドキュメントは、AWS EC2 インスタンス上で dify-usage-exporter を Docker で運用する手順を説明します。

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│  AWS EC2 インスタンス                                        │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              dify-usage-exporter (Docker)               │ │
│  │                                                         │ │
│  │  1. Dify からデータ取得                                  │ │
│  │  2. API_Meter へ送信                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │                                │
          ▼ HTTPS                          ▼ HTTPS
┌───────────────────────┐    ┌───────────────────────────────┐
│  Dify                 │    │  API_Meter (Vercel)           │
│  dxj-sv-0328.ad.      │    │  v0-cloud-api-meter.vercel.app│
│  dexerials.com        │    │                               │
└───────────────────────┘    └───────────────────────────────┘
```

### 接続情報

| サービス | URL | 備考 |
|----------|-----|------|
| Dify | https://dxj-sv-0328.ad.dexerials.com | `/apps` は含めない |
| API_Meter ダッシュボード | https://v0-cloud-api-meter.vercel.app/dashboard | 確認用 |
| API_Meter エンドポイント | https://v0-cloud-api-meter.vercel.app/api/integrations/dify/usage-data/receive | データ送信先 |

---

## 1. 前提条件

### 1.1 EC2 環境の確認

EC2 に SSH 接続して以下を確認:

```bash
# Docker が動作していることを確認
docker --version
docker compose version

# Git がインストールされていることを確認
git --version
```

### 1.2 ネットワーク接続の確認

EC2 から各サービスにアクセスできることを確認:

```bash
# Dify への接続確認
curl -I https://dxj-sv-0328.ad.dexerials.com

# API_Meter への接続確認
curl -I https://v0-cloud-api-meter.vercel.app
```

> **注意**: セキュリティグループでアウトバウンド HTTPS (443) が許可されていることを確認してください。

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
# Dify API 接続情報
# ============================================
# Dify の URL（/apps は含めない）
DIFY_API_BASE_URL=https://dxj-sv-0328.ad.dexerials.com

# Dify の管理者アカウント（コンソールログイン用）
DIFY_EMAIL=your-dify-admin-email@example.com
DIFY_PASSWORD=your-dify-password

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

### 2.3 設定のポイント

| 設定項目 | 値 | 注意事項 |
|---------|-----|---------|
| DIFY_API_BASE_URL | `https://dxj-sv-0328.ad.dexerials.com` | `/apps` は **含めない** |
| DIFY_EMAIL | Dify管理者のメール | コンソールにログインできるアカウント |
| DIFY_PASSWORD | Difyパスワード | 特殊文字がある場合はクォートで囲む |
| CRON_SCHEDULE | `0 16 * * *` | **UTC** で設定（JST -9時間） |

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

```json
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
# EC2 から Dify への接続テスト
curl -I https://dxj-sv-0328.ad.dexerials.com

# DNS 解決確認
nslookup dxj-sv-0328.ad.dexerials.com
```

**対処法:**
1. EC2 のセキュリティグループでアウトバウンド 443 が許可されているか確認
2. VPC の DNS 設定を確認
3. ドメインが社内ネットワーク限定の場合、VPN や DirectConnect の設定を確認

### 5.2 SSL 証明書エラー

**エラー:** `UNABLE_TO_VERIFY_LEAF_SIGNATURE` または `CERT_HAS_EXPIRED`

**対処法（自己署名証明書の場合）:**

`.env` に以下を追加:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0
```

> **警告**: 本番環境では正規の SSL 証明書を使用することを推奨します。

### 5.3 Dify ログイン失敗

**エラー:** `401 Unauthorized` または `Invalid credentials`

```bash
# ログイン API の動作確認
curl -X POST https://dxj-sv-0328.ad.dexerials.com/console/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

**対処法:**
1. `.env` の `DIFY_EMAIL` と `DIFY_PASSWORD` を確認
2. Dify 管理画面（https://dxj-sv-0328.ad.dexerials.com/apps）でログインできるか確認
3. パスワードに特殊文字がある場合はクォートで囲む

### 5.4 API_Meter 送信エラー

**エラー:** `401 AUTH_TOKEN_INVALID`

**対処法:**
1. `EXTERNAL_API_TOKEN` が正しいか確認
2. `API_METER_TENANT_ID` が正しい UUID 形式か確認

```bash
# 設定値を確認
docker compose exec dify-usage-exporter printenv | grep -E "(EXTERNAL_API|API_METER)"
```

### 5.5 スケジュールが動作しない

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

## 付録

### A. クイックスタート

```bash
# 1. クローン
cd ~/apps
git clone https://github.com/Ardama18/dify-usage-exporter.git
cd dify-usage-exporter

# 2. 環境変数設定
cp .env.example .env
nano .env  # 以下を設定:
           # - DIFY_API_BASE_URL=https://dxj-sv-0328.ad.dexerials.com
           # - DIFY_EMAIL / DIFY_PASSWORD
           # - EXTERNAL_API_TOKEN / API_METER_TENANT_ID

# 3. テスト実行
docker compose build
docker compose run --rm dify-usage-exporter node dist/index.js

# 4. スケジュール起動
docker compose up -d
```

### B. 環境変数一覧

| 変数名 | 必須 | 設定例 | 説明 |
|--------|------|--------|------|
| DIFY_API_BASE_URL | ○ | `https://dxj-sv-0328.ad.dexerials.com` | Dify URL（/apps 含めない） |
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

### D. 接続確認コマンド

```bash
# Dify への接続確認
curl -I https://dxj-sv-0328.ad.dexerials.com

# Dify ログイン API テスト
curl -X POST https://dxj-sv-0328.ad.dexerials.com/console/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email","password":"your-password"}'

# API_Meter への接続確認
curl -I https://v0-cloud-api-meter.vercel.app
```
