# AWS EC2 Docker デプロイメントガイド

## 概要

本ドキュメントは、dify-usage-exporter を AWS EC2 インスタンス上で Docker を使用して運用するための手順を説明します。

---

## 1. 前提条件

### 1.1 AWS EC2 インスタンス要件

| 項目 | 推奨値 | 備考 |
|------|--------|------|
| インスタンスタイプ | t3.micro 以上 | 軽量なバッチ処理のため最小構成で可 |
| OS | Amazon Linux 2023 | または Ubuntu 22.04 LTS |
| ストレージ | 8GB 以上 | Docker イメージ + ログ用 |
| セキュリティグループ | アウトバウンド 443 許可 | Dify API、API_Meter への HTTPS 通信 |

### 1.2 ネットワーク要件

- **Dify API**: インスタンスから Dify サーバーへの HTTPS アクセス
- **API_Meter**: インスタンスから API_Meter サーバーへの HTTPS アクセス
- **SSH**: 管理用（ポート 22）

---

## 2. EC2 インスタンスのセットアップ

### 2.1 インスタンス作成

1. AWS コンソールで EC2 インスタンスを起動
2. Amazon Linux 2023 AMI を選択
3. t3.micro インスタンスタイプを選択
4. セキュリティグループ設定:
   - インバウンド: SSH (22) - 管理用IP からのみ許可
   - アウトバウンド: HTTPS (443) - 0.0.0.0/0

### 2.2 SSH 接続

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### 2.3 Docker のインストール（Amazon Linux 2023）

```bash
# パッケージ更新
sudo dnf update -y

# Docker インストール
sudo dnf install -y docker

# Docker サービス開始・自動起動設定
sudo systemctl start docker
sudo systemctl enable docker

# ec2-user を docker グループに追加
sudo usermod -aG docker ec2-user

# グループ変更を反映（再ログインまたは以下を実行）
newgrp docker

# 動作確認
docker --version
docker run hello-world
```

### 2.4 Docker Compose のインストール

```bash
# Docker Compose プラグインのインストール
sudo dnf install -y docker-compose-plugin

# 動作確認
docker compose version
```

### 2.5 Git のインストール

```bash
sudo dnf install -y git
git --version
```

---

## 3. プロジェクトのデプロイ

### 3.1 リポジトリのクローン

```bash
# 作業ディレクトリ作成
mkdir -p ~/apps
cd ~/apps

# リポジトリをクローン
git clone https://github.com/Ardama18/dify-usage-exporter.git
cd dify-usage-exporter
```

### 3.2 環境変数の設定

```bash
# .env ファイルを作成
cp .env.example .env

# エディタで編集
nano .env
```

**.env ファイルの設定内容:**

```bash
# === 必須設定 ===

# Dify API 接続情報
DIFY_API_BASE_URL=https://your-dify-instance.com
DIFY_EMAIL=your-dify-email@example.com
DIFY_PASSWORD=your-dify-password

# API_Meter 接続情報
EXTERNAL_API_URL=https://api-meter.example.com/api/integrations/dify/usage-data/receive
EXTERNAL_API_TOKEN=your-bearer-token
API_METER_TENANT_ID=00000000-0000-0000-0000-000000000001

# === スケジュール設定 ===

# Cron 形式: 分 時 日 月 曜日
# 例: 毎日 AM 1:00 (JST) に実行 → UTC で 16:00
CRON_SCHEDULE=0 16 * * *

# === 取得期間設定 ===

# today: 本日のみ
# yesterday: 昨日のみ
# current_month: 今月全体（デフォルト）
# last_month: 先月全体
DIFY_FETCH_PERIOD=current_month

# === オプション設定 ===

LOG_LEVEL=info
NODE_ENV=production
MAX_RETRY=3
```

> **注意**: CRON_SCHEDULE は UTC で設定します。JST の場合は -9 時間してください。

### 3.3 環境変数の確認

```bash
# 設定内容を確認（パスワード等は伏せて表示）
grep -E "^[A-Z]" .env | sed 's/PASSWORD=.*/PASSWORD=***/' | sed 's/TOKEN=.*/TOKEN=***/'
```

---

## 4. Docker での起動

### 4.1 イメージのビルド

```bash
# イメージをビルド
docker compose build

# ビルド結果を確認
docker images | grep dify-usage-exporter
```

### 4.2 コンテナの起動

```bash
# バックグラウンドで起動
docker compose up -d

# 起動状態を確認
docker compose ps
```

**期待される出力:**

```
NAME                    STATUS              PORTS
dify-usage-exporter     Up X minutes (healthy)
```

### 4.3 ログの確認

```bash
# リアルタイムでログを表示
docker compose logs -f

# 直近100行を表示
docker compose logs --tail=100
```

### 4.4 手動実行（テスト）

スケジュール実行前に手動でテストする場合:

```bash
# コンテナ内でスクリプトを実行
docker compose exec dify-usage-exporter node dist/index.js --run-once

# または新しいコンテナで実行
docker compose run --rm dify-usage-exporter node dist/index.js --run-once
```

---

## 5. 運用管理

### 5.1 コンテナの管理

```bash
# 停止
docker compose stop

# 再起動
docker compose restart

# 完全停止・削除
docker compose down

# ボリュームも含めて削除（データ消失注意）
docker compose down -v
```

### 5.2 ログの管理

ログは JSON 形式で保存され、自動ローテーションされます（10MB × 3ファイル）。

```bash
# ログファイルの場所を確認
docker inspect dify-usage-exporter | grep LogPath

# 特定の日付のログを検索
docker compose logs | grep "2025-12-15"

# エラーログのみ表示
docker compose logs | grep '"level":"error"'
```

### 5.3 ヘルスチェック

```bash
# ヘルスステータス確認
docker inspect dify-usage-exporter --format='{{.State.Health.Status}}'

# ヘルスチェック履歴
docker inspect dify-usage-exporter --format='{{json .State.Health}}' | jq
```

### 5.4 データの永続化

ウォーターマークやスプールファイルは Docker ボリュームに保存されます。

```bash
# ボリュームの確認
docker volume ls | grep exporter

# ボリュームの詳細
docker volume inspect dify-usage-exporter_exporter-data
```

---

## 6. アップデート手順

### 6.1 アプリケーションの更新

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

### 6.2 環境変数の変更

```bash
# .env を編集
nano .env

# コンテナを再起動（再ビルド不要）
docker compose down
docker compose up -d
```

---

## 7. トラブルシューティング

### 7.1 コンテナが起動しない

```bash
# エラーログを確認
docker compose logs

# コンテナの詳細状態を確認
docker inspect dify-usage-exporter
```

**よくある原因:**
- 環境変数の設定ミス
- Dify API への接続エラー
- 認証情報の誤り

### 7.2 Dify API 接続エラー

```bash
# コンテナ内から接続テスト
docker compose exec dify-usage-exporter wget -q --spider https://your-dify-instance.com
echo $?  # 0 なら接続成功
```

**確認事項:**
- `DIFY_API_BASE_URL` が正しいか
- セキュリティグループでアウトバウンド 443 が許可されているか
- Dify サーバーが稼働しているか

### 7.3 API_Meter 送信エラー

```bash
# 認証テスト
docker compose exec dify-usage-exporter sh -c 'wget -q -O- --header="Authorization: Bearer $EXTERNAL_API_TOKEN" $EXTERNAL_API_URL'
```

**確認事項:**
- `EXTERNAL_API_TOKEN` が正しいか
- `API_METER_TENANT_ID` が正しいか
- API_Meter サーバーが稼働しているか

### 7.4 スケジュール実行されない

```bash
# 現在のスケジュール設定を確認
docker compose exec dify-usage-exporter printenv | grep CRON

# タイムゾーンを確認（UTC）
docker compose exec dify-usage-exporter date
```

**確認事項:**
- `CRON_SCHEDULE` が UTC で正しく設定されているか
- コンテナが正常に稼働しているか

### 7.5 メモリ不足

```bash
# コンテナのリソース使用状況
docker stats dify-usage-exporter --no-stream
```

必要に応じて EC2 インスタンスタイプをアップグレードしてください。

---

## 8. セキュリティ考慮事項

### 8.1 認証情報の管理

- `.env` ファイルのパーミッションを制限: `chmod 600 .env`
- 本番環境では AWS Secrets Manager の利用を検討
- Git に `.env` をコミットしない（`.gitignore` で除外済み）

### 8.2 ネットワークセキュリティ

- セキュリティグループで必要最小限のポートのみ許可
- SSH は管理用 IP からのみアクセス可能に制限
- VPC 内で運用する場合は Private Subnet の利用を検討

### 8.3 ログの取り扱い

- ログには認証情報が含まれないことを確認
- 長期保存が必要な場合は CloudWatch Logs への転送を検討

---

## 9. 監視・アラート（オプション）

### 9.1 CloudWatch との連携

```bash
# CloudWatch Logs エージェントのインストール
sudo dnf install -y amazon-cloudwatch-agent

# 設定ファイルの作成
sudo nano /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

### 9.2 ヘルスチェック監視

外部監視サービス（UptimeRobot 等）でヘルスチェックエンドポイントを監視:

```
http://<EC2_PUBLIC_IP>:8080/health
```

> **注意**: ヘルスチェックポートを外部公開する場合はセキュリティグループの設定が必要です。

---

## 10. バックアップ・リストア

### 10.1 データのバックアップ

```bash
# ボリュームデータをバックアップ
docker run --rm -v dify-usage-exporter_exporter-data:/data -v $(pwd):/backup alpine tar czf /backup/exporter-data-backup.tar.gz -C /data .
```

### 10.2 リストア

```bash
# バックアップからリストア
docker run --rm -v dify-usage-exporter_exporter-data:/data -v $(pwd):/backup alpine tar xzf /backup/exporter-data-backup.tar.gz -C /data
```

---

## 付録

### A. クイックスタートコマンド一覧

```bash
# 初回セットアップ
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker ec2-user && newgrp docker
sudo dnf install -y docker-compose-plugin

# デプロイ
cd ~/apps && git clone https://github.com/Ardama18/dify-usage-exporter.git
cd dify-usage-exporter && cp .env.example .env && nano .env
docker compose build && docker compose up -d

# 運用
docker compose ps          # ステータス確認
docker compose logs -f     # ログ確認
docker compose restart     # 再起動
docker compose down        # 停止
```

### B. 推奨 Cron スケジュール例

| 用途 | CRON_SCHEDULE (UTC) | 説明 |
|------|---------------------|------|
| 毎日 AM 1:00 JST | `0 16 * * *` | 日次バッチ |
| 毎日 AM 6:00 JST | `0 21 * * *` | 早朝バッチ |
| 毎月 1日 AM 0:00 JST | `0 15 1 * *` | 月次バッチ |
| 毎週月曜 AM 9:00 JST | `0 0 * * 1` | 週次バッチ |

### C. 環境変数一覧

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| DIFY_API_BASE_URL | ○ | - | Dify API の URL |
| DIFY_EMAIL | ○ | - | Dify ログインメール |
| DIFY_PASSWORD | ○ | - | Dify ログインパスワード |
| EXTERNAL_API_URL | ○ | - | API_Meter の URL |
| EXTERNAL_API_TOKEN | ○ | - | API_Meter の Bearer トークン |
| API_METER_TENANT_ID | ○ | - | テナント ID (UUID) |
| CRON_SCHEDULE | - | `0 0 1 * *` | 実行スケジュール (UTC) |
| DIFY_FETCH_PERIOD | - | `current_month` | 取得期間 |
| LOG_LEVEL | - | `info` | ログレベル |
| NODE_ENV | - | `production` | 実行環境 |
| MAX_RETRY | - | `3` | リトライ回数 |
