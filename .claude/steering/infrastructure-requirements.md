# インフラ要件定義ガイドライン

AWSインフラ設計時の要件定義と検証基準。AWS Well-Architected Frameworkに準拠した高品質なインフラを構築するためのルール。

## 関連ドキュメント

このドキュメントはAWSインフラ設計の**要件定義フェーズ**で使用します。

**関連ステアリングファイル**:
- **cdk-best-practices.md**: このドキュメントの要件をCDKコードで実装する際のベストプラクティス
- **infrastructure-testing.md**: 設計したインフラの品質を保証するテスト戦略

**実装順序**:
1. **要件定義**（本ファイル）: AWS Well-Architected Framework 6本柱に基づく要件定義
2. **ADR作成**: 技術選択肢の評価（infrastructure-designerエージェント使用）
3. **CDK実装**: cdk-best-practices.md参照（cdk-implementerエージェント使用）
4. **テスト**: infrastructure-testing.md参照（infrastructure-validatorエージェント使用）

**チェックリスト連携**:
- 本ファイルの必須チェック項目 → cdk-best-practices.md の実装チェックリスト → infrastructure-testing.md のテストケース

## AWS Well-Architected Framework 6本柱

### 1. 運用の優秀性（Operational Excellence）

**原則**:
- インフラのコード化（Infrastructure as Code）
- 変更の頻繁な小規模実施
- 運用手順の定期的な改善
- 障害の予測と対応

**必須チェック項目**:
- [ ] CDKコードでインフラ全体を管理
- [ ] CloudWatch Logs/Metricsで監視設定
- [ ] CloudWatch Alarmsで異常検知
- [ ] Systems Manager（SSM）でパラメータ管理
- [ ] AWS CloudFormation ChangeSetsで変更確認
- [ ] タグ戦略（環境、コスト配分、所有者）

**運用自動化**:
```yaml
監視対象:
  - Lambda関数: エラー率、実行時間、同時実行数
  - RDS/DynamoDB: 接続数、CPU使用率、ストレージ
  - API Gateway: レイテンシ、4xx/5xx エラー率
  - ECS/EKS: CPU/メモリ使用率、タスク数

アラート設定:
  - Critical: エラー率 > 5%、レイテンシ > 3s
  - Warning: エラー率 > 1%、レイテンシ > 1s
```

### 2. セキュリティ（Security）

**原則**:
- 最小権限の原則（Least Privilege）
- トレーサビリティの確保
- 全レイヤーでのセキュリティ適用
- データ保護の自動化

**必須セキュリティチェック**:
- [ ] IAMロール: 最小権限、インラインポリシー禁止
- [ ] VPC: プライベートサブネット配置、セキュリティグループ最小化
- [ ] データ暗号化: S3（SSE-S3/KMS）、RDS（暗号化必須）、転送中（TLS 1.2+）
- [ ] Secrets Manager: 認証情報の保管（平文禁止）
- [ ] CloudTrail: 全APIアクション記録
- [ ] GuardDuty: 脅威検出の有効化（本番環境）
- [ ] WAF: 公開APIの保護（SQLi, XSS対策）

**IAM設計原則**:
```typescript
// 良い例: 明示的な権限、最小スコープ
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::my-bucket/specific-prefix/*"
}

// 悪い例: ワイルドカード、全リソース
{
  "Effect": "Allow",
  "Action": "s3:*",
  "Resource": "*"
}
```

**データ分類とセキュリティレベル**:
| データ分類 | 暗号化 | アクセス制御 | ログ保持 | 例 |
|----------|-------|------------|---------|-----|
| Public | 不要 | 読み取り公開 | 30日 | 静的コンテンツ |
| Internal | SSE-S3 | IAMロール | 90日 | アプリログ |
| Confidential | SSE-KMS | 厳格なIAM | 1年 | ユーザーデータ |
| Restricted | SSE-KMS + 監査 | MFA必須 | 7年 | 個人情報、金融情報 |

### 3. 信頼性（Reliability）

**原則**:
- 障害からの自動復旧
- 復旧手順のテスト
- 水平スケーリング
- キャパシティ推測の排除

**必須チェック項目**:
- [ ] マルチAZ配置（RDS, ECS, ALB）
- [ ] Auto Scaling設定
- [ ] ヘルスチェック設定（ALB, Route 53）
- [ ] バックアップ戦略（RDS自動バックアップ、S3バージョニング）
- [ ] DLQ（Dead Letter Queue）設定（Lambda, SQS）
- [ ] リトライ・タイムアウト設定

**可用性ターゲット**:
```yaml
環境別SLA:
  本番環境: 99.9% （月間43.2分のダウンタイム許容）
    - マルチAZ必須
    - Auto Scaling必須
    - Route 53ヘルスチェック

  ステージング: 99.5% （月間3.6時間）
    - シングルAZ可
    - Auto Scaling推奨

  開発環境: 95% （月間36時間）
    - シングルAZ
    - Auto Scaling不要
```

**RPO/RTOの定義**:
- **RPO（Recovery Point Objective）**: データ損失許容時間
  - Critical: 5分以内（DynamoDB PITR、S3 Cross-Region Replication）
  - High: 1時間以内（RDS自動バックアップ）
  - Medium: 24時間以内（日次バックアップ）
- **RTO（Recovery Time Objective）**: システム復旧目標時間
  - Critical: 30分以内
  - High: 4時間以内
  - Medium: 24時間以内

### 4. パフォーマンス効率（Performance Efficiency）

**原則**:
- 高度な技術の民主化
- グローバル展開の迅速化
- サーバーレスアーキテクチャの活用
- 実験の頻繁な実施

**必須チェック項目**:
- [ ] CloudFront CDNの活用（静的コンテンツ）
- [ ] ElastiCache/DAXキャッシング戦略
- [ ] Lambda同時実行数制限設定
- [ ] RDS/DynamoDBのキャパシティ最適化
- [ ] Auto Scalingポリシー（ターゲット追跡、ステップスケーリング）

**コンピューティング選択基準**:
| サービス | 適用シーン | スケーラビリティ | コスト | 管理負荷 |
|---------|----------|----------------|-------|---------|
| Lambda | イベント駆動、短時間処理 | 自動無制限 | 低（従量課金） | 最小 |
| ECS Fargate | コンテナ、中期間処理 | 自動（タスク単位） | 中 | 低 |
| ECS EC2 | 高スループット、常時稼働 | 手動＋Auto Scaling | 中-高 | 中 |
| EKS | Kubernetes必須、複雑なオーケストレーション | 高度なカスタマイズ | 高 | 高 |
| EC2 | レガシー、特殊要件 | Auto Scaling | 中 | 高 |

**データベース選択基準**:
| サービス | データ特性 | クエリパターン | スケール | 整合性 |
|---------|-----------|--------------|---------|--------|
| DynamoDB | Key-Value、ドキュメント | 単純な読み取り | 無制限 | 結果整合性 |
| Aurora | リレーショナル、トランザクション | 複雑なJOIN | 垂直+リードレプリカ | 強整合性 |
| RDS | リレーショナル、既存DB移行 | SQL標準 | 垂直スケール | 強整合性 |
| DocumentDB | MongoDB互換 | ドキュメント指向 | 水平スケール | 結果整合性 |

### 5. コスト最適化（Cost Optimization）

**原則**:
- 消費モデルの採用（従量課金）
- 全体的な効率の測定
- データセンター運用費用の削減
- 費用の分析と帰属

**必須チェック項目**:
- [ ] Cost Explorerでコスト可視化
- [ ] Budgetsでアラート設定
- [ ] 未使用リソースの削除（EIP, EBS Snapshot）
- [ ] 適切なインスタンスサイジング
- [ ] Savings Plans/Reserved Instancesの検討
- [ ] S3ライフサイクルポリシー（Glacier移行）

**コスト見積もりテンプレート（2025年東京リージョン ap-northeast-1 料金）**:
```yaml
月間コスト見積もり:
  コンピューティング:
    Lambda:
      計算式: (実行時間ms / 1000 × メモリGB × $0.0000166667) + (リクエスト数 / 1,000,000 × $0.20)
      例: 100万req/月、512MB、平均200ms = (0.2 × 0.5 × 100万 × $0.0000166667) + $0.20 = $16.67 + $0.20 = $16.87/月

    ECS Fargate:
      計算式: (vCPU数 × $0.04656/時間 × 稼働時間) + (GB数 × $0.00511/時間 × 稼働時間)
      例: 0.25vCPU + 0.5GB、常時稼働 = (0.25 × $0.04656 × 730) + (0.5 × $0.00511 × 730) = $8.49 + $1.87 = $10.36/月

    EC2 (t3.medium):
      計算式: $インスタンスタイプ料金/時間 × 稼働時間
      例: t3.medium $0.0544/時間 × 730時間 = $39.71/月

  データベース:
    RDS PostgreSQL (db.t3.medium):
      計算式: ($インスタンス料金/時間 × 730) + (ストレージGB × $0.138/GB) + (バックアップGB × $0.023/GB)
      例: ($0.088 × 730) + (100GB × $0.138) + (50GB × $0.023) = $64.24 + $13.80 + $1.15 = $79.19/月

    DynamoDB (オンデマンド):
      計算式: (読み取りリクエスト / 1,000,000 × $0.285) + (書き込みリクエスト / 1,000,000 × $1.4275) + (ストレージGB × $0.285)
      例: 100万読み取り、10万書き込み、10GB = $0.285 + $0.14 + $2.85 = $3.28/月

  ネットワーク:
    データ転送 (Internet向け):
      計算式: 最初10TB/月は $0.114/GB
      例: 500GB × $0.114 = $57/月

    ALB:
      計算式: ($0.0243/時間 × 730) + (LCU × $0.008/時間 × 730)
      例: 時間料金 + (10 LCU × $0.008 × 730) = $17.74 + $58.40 = $76.14/月

    NAT Gateway:
      計算式: ($0.062/時間 × 730 × ゲートウェイ数) + (データ処理GB × $0.062)
      例: ($0.062 × 730 × 2) + (500GB × $0.062) = $90.52 + $31 = $121.52/月

  ストレージ:
    S3 Standard:
      計算式: (ストレージGB × $0.025) + (PUT/POST × $0.0047/1000) + (GET × $0.00037/1000)
      例: 100GB + 100万PUT + 1000万GET = $2.50 + $4.70 + $3.70 = $10.90/月

    EBS gp3:
      計算式: ボリュームGB × $0.096/GB
      例: 100GB × $0.096 = $9.60/月

  合計: $XXX/月（想定トラフィック: XX req/s）

料金確認方法:
  1. AWS Pricing Calculator: https://calculator.aws/#/
  2. AWS CLI: aws pricing get-products --service-code AmazonEC2 --region ap-northeast-1 --filters "Type=TERM_MATCH,Field=instanceType,Value=t3.medium"
  3. CDK出力: cdk synth --all | grep "Estimated cost"
  4. Cost Explorer API: boto3.client('ce').get_cost_forecast()

注意事項:
  - 料金は2025年時点の東京リージョン（ap-northeast-1）価格
  - 実際の料金はAWS公式サイトで最新情報を確認
  - データ転送料金はリージョン・サービス間で異なる
  - Reserved Instances/Savings Plansで最大72%割引可能
```

**コスト削減チェックリスト**:
- [ ] 開発/ステージング環境の夜間停止（Lambda EventBridge）
- [ ] S3 Intelligent-Tieringの活用
- [ ] CloudFrontでオリジン負荷削減
- [ ] Lambda関数のメモリ最適化
- [ ] RDS/EC2のリザーブドインスタンス（稼働率 > 70%）

### 6. 持続可能性（Sustainability）【2024年11月追加】

**原則**:
- エネルギー効率の最大化
- リソース使用量の最小化
- カーボンフットプリントの削減
- 持続可能な設計パターンの採用

**必須チェック項目**:
- [ ] Graviton（Arm64）インスタンス採用検討（最大40%の省エネ）
- [ ] リージョン選択時のカーボンフットプリント考慮
- [ ] 未使用リソースの自動削除（スケジューリング）
- [ ] サーバーレスアーキテクチャの優先採用
- [ ] ストレージのライフサイクル管理（S3 Glacier, Deep Archive）
- [ ] リソース使用率の最適化（アイドルリソース削減）

**サステナビリティメトリクス**:
```yaml
測定項目:
  CPU使用率:
    目標: > 50%
    理由: アイドルリソース削減
    測定方法: CloudWatch MetricsでCPUUtilization確認

  ストレージ使用率:
    目標: > 70%
    理由: 過剰プロビジョニング回避
    測定方法: S3 Storage Lens、EBS Volume使用率

  Graviton採用率:
    目標: > 30%（新規リソース）
    理由: 省エネ・高性能（x86比40%省エネ）
    測定方法: Lambda/ECS/EC2でarm64 architecture採用率

  自動停止設定率:
    目標: 開発環境 100%
    理由: 非稼働時間のコスト・エネルギー削減
    測定方法: EventBridge Rulesで自動停止/起動設定確認

  カーボンフットプリント:
    目標: 前年比 10%削減
    理由: 環境負荷低減
    測定方法: AWS Customer Carbon Footprint Tool
```

**Graviton採用ガイドライン**:
```yaml
Lambda:
  推奨: Node.js, Python, Java, .NET Core, Ruby
  architecture: arm64
  メリット: 最大34%のパフォーマンス向上、20%のコスト削減

ECS Fargate:
  推奨: すべてのコンテナワークロード
  cpuArchitecture: ARM64
  メリット: 最大40%の価格性能比向上

RDS:
  推奨: PostgreSQL, MySQL, MariaDB
  instanceClass: db.r7g, db.m7g, db.t4g
  メリット: 最大35%の価格性能比向上

非推奨:
  - x86固有の依存がある場合（レガシーバイナリ等）
  - アーキテクチャ移行コストが高い既存システム
```

**リージョン別カーボンフットプリント考慮**:
```yaml
低カーボンリージョン（再生可能エネルギー比率高）:
  - us-west-2 (Oregon): 水力発電主体
  - eu-north-1 (Stockholm): 再生可能エネルギー90%以上
  - ca-central-1 (Canada): 水力発電主体

標準リージョン:
  - ap-northeast-1 (Tokyo): 都市部近接、レイテンシ優先時

選択基準:
  1. レイテンシ要件（< 50ms → 近接リージョン優先）
  2. データレジデンシー要件（GDPR等）
  3. 上記を満たす場合 → 低カーボンリージョン選択
```

**サステナビリティ設計パターン**:
1. **右サイジング（Rightsizing）**: 過剰スペック回避、使用率最大化
2. **イベント駆動アーキテクチャ**: 常時稼働リソース削減
3. **サーバーレス優先**: 使用時のみリソース消費
4. **ストレージ階層化**: 頻繁アクセスデータのみ高速ストレージ
5. **自動スケーリング**: 需要に応じたリソース調整

## セキュリティコンプライアンス

### GDPR対応（EU市民データ処理時）
- [ ] データ保持期間の定義（自動削除）
- [ ] データ削除リクエスト対応（Right to be forgotten）
- [ ] データポータビリティ（エクスポート機能）
- [ ] データ処理の同意管理
- [ ] EU内リージョン使用（eu-west-1, eu-central-1）

### SOC2対応（SaaSサービス提供時）
- [ ] アクセスログの記録と監査
- [ ] 変更管理プロセス（CloudFormation ChangeSets）
- [ ] データ暗号化（保管時・転送時）
- [ ] 脆弱性スキャン（Inspector, GuardDuty）
- [ ] インシデント対応プロセス

### HIPAA対応（医療情報取り扱い時）
- [ ] BAA（Business Associate Agreement）の締結
- [ ] HIPAA対応サービスのみ使用（Lambda, S3, RDS等）
- [ ] PHIの暗号化（KMS）
- [ ] 監査ログの7年保持
- [ ] アクセス制御の厳格化（MFA必須）

## ネットワーク設計

### VPC設計パターン

**シングルVPC（推奨：小〜中規模）**:
```
VPC: 10.0.0.0/16
├── Public Subnet-1a: 10.0.0.0/24 (ALB, NAT Gateway)
├── Public Subnet-1c: 10.0.1.0/24 (ALB, NAT Gateway)
├── Private Subnet-1a: 10.0.10.0/24 (ECS, Lambda)
├── Private Subnet-1c: 10.0.11.0/24 (ECS, Lambda)
├── Data Subnet-1a: 10.0.20.0/24 (RDS, ElastiCache)
└── Data Subnet-1c: 10.0.21.0/24 (RDS, ElastiCache)
```

**マルチVPC（大規模、環境分離）**:
```
Production VPC: 10.0.0.0/16
Staging VPC: 10.1.0.0/16
Development VPC: 10.2.0.0/16
Transit Gateway for cross-VPC communication
```

### セキュリティグループ設計原則

**最小権限の徹底**:
```typescript
// ALB Security Group
ingress: [
  { protocol: 'tcp', port: 443, source: '0.0.0.0/0' }, // HTTPS
  { protocol: 'tcp', port: 80, source: '0.0.0.0/0' },  // HTTP（リダイレクト用）
]

// ECS Security Group
ingress: [
  { protocol: 'tcp', port: 8080, source: ALB_SG }, // ALBからのみ
]

// RDS Security Group
ingress: [
  { protocol: 'tcp', port: 5432, source: ECS_SG }, // ECSからのみ
]
```

## ディザスタリカバリ戦略

### DR戦略の選択

| 戦略 | RPO | RTO | コスト | 複雑度 | 適用シーン |
|------|-----|-----|-------|--------|----------|
| Backup & Restore | 時間単位 | 日単位 | 低 | 低 | 非Critical |
| Pilot Light | 分単位 | 時間単位 | 中 | 中 | Medium Critical |
| Warm Standby | 分単位 | 分単位 | 高 | 中 | High Critical |
| Multi-Site Active/Active | リアルタイム | 秒単位 | 最高 | 高 | Mission Critical |

### 推奨構成（Pilot Light）
```yaml
Primary Region: ap-northeast-1 (Tokyo)
  - 全サービス稼働
  - DynamoDBグローバルテーブル
  - S3クロスリージョンレプリケーション

DR Region: us-west-2 (Oregon)
  - RDS リードレプリカ（自動プロモーション準備）
  - AMI/ECRイメージの複製
  - Route 53ヘルスチェック＋自動フェイルオーバー
```

## タグ戦略

### 必須タグ（全リソース）
```typescript
const mandatoryTags = {
  Environment: 'production | staging | development',
  Project: 'project-name',
  Owner: 'team-name',
  CostCenter: 'cost-allocation-tag',
  ManagedBy: 'cdk',
}
```

### オプションタグ（用途別）
```typescript
const optionalTags = {
  BackupPolicy: 'daily | weekly | none',
  Compliance: 'gdpr | hipaa | sox',
  DataClassification: 'public | internal | confidential | restricted',
  AutoShutdown: 'true | false', // 開発環境の夜間停止
}
```

## エスカレーション基準（自動判定可能）

以下の条件に該当する場合は設計前にユーザー確認必須：

### 1. コスト影響大

**自動判定基準**:
- 月額見積もり > $1,000
- 既存環境からのコスト増加率 > 50%
- 新規AWSサービス導入（過去の利用実績なし）
- Savings Plans/Reserved Instances未適用で稼働率 > 70%

**判定方法**:
```bash
# CDK合成後のコスト見積もり
npx cdk synth --all | grep -E "Cost|Price"

# または Cost Explorerでシミュレーション
aws ce get-cost-forecast --time-period Start=2025-11-01,End=2025-12-01 --metric BLENDED_COST --granularity MONTHLY
```

### 2. セキュリティリスク

**自動判定基準**:
- インターネット公開API追加（Security Groupで0.0.0.0/0許可）
- 個人情報処理（PII: email, name, address, phone, SSN等）
- 認証情報管理の変更（Secrets Manager, IAM Role/Policy変更）
- KMS暗号化未設定（S3, RDS, DynamoDB）
- CloudTrail無効化

**判定方法**:
```bash
# Security Group 0.0.0.0/0チェック
cat cdk.out/*.template.json | jq -r '.Resources | to_entries[] | select(.value.Type == "AWS::EC2::SecurityGroup") | select(.value.Properties.SecurityGroupIngress[]?.CidrIp == "0.0.0.0/0")'

# 暗号化未設定チェック
cat cdk.out/*.template.json | jq -r '.Resources | to_entries[] | select(.value.Type == "AWS::S3::Bucket") | select(.value.Properties.BucketEncryption? == null)'
```

### 3. コンプライアンス要件

**自動判定基準**:
- GDPR対応（EU市民データ処理、EUリージョン使用）
- HIPAA対応（医療情報取り扱い、PHI処理）
- SOC2対応（SaaSサービス提供、監査ログ要件）
- データ保持期間 > 1年（法的要件の可能性）

**判定方法**:
```bash
# EUリージョン使用チェック
grep -E "eu-west|eu-central|eu-north" cdk.out/*.template.json

# CloudTrail有効化チェック
cat cdk.out/*.template.json | jq '.Resources | to_entries[] | select(.value.Type == "AWS::CloudTrail::Trail")'
```

### 4. マルチリージョン構成

**自動判定基準**:
- 2リージョン以上へのデプロイ
- クロスリージョンレプリケーション（S3, DynamoDB Global Tables）
- Route 53ヘルスチェック + フェイルオーバー設定

**判定方法**:
```bash
# リージョン数カウント
cat cdk.out/*.template.json | jq -r '.Resources | to_entries[].value.Properties | select(.Region?) | .Region' | sort -u | wc -l
```

### 5. サービス制限超過リスク

**自動判定基準**:
| サービス | デフォルト制限 | エスカレーション閾値 |
|---------|-------------|-------------------|
| Lambda同時実行数 | 1,000 | > 800 |
| VPC数 | 5 | > 4 |
| EIP数 | 5 | > 4 |
| Security Group数 | 2,500/VPC | > 2,000 |
| CloudFormation Stack数 | 200 | > 150 |
| RDS Instances | 40 | > 30 |

**判定方法**:
```bash
# 現在の使用量確認
aws service-quotas list-service-quotas --service-code lambda --query 'Quotas[?QuotaName==`Concurrent executions`]'

# Lambda同時実行数チェック
cat cdk.out/*.template.json | jq '[.Resources | to_entries[] | select(.value.Type == "AWS::Lambda::Function")] | length'
```

### 6. 既存システム影響

**自動判定基準**:
- VPC CIDR変更、Subnet追加/削除
- Security Groupルール削除（Ingress/Egress削除）
- IAMポリシー変更（権限削除、Action削除）
- Route Table変更
- KMSキー削除・ローテーション

**判定方法**:
```bash
# 破壊的変更検出
npx cdk diff --fail-on-destructive-changes ProductionStack

# 特定リソースの変更確認
npx cdk diff ProductionStack | grep -E "Replacement|Delete|Remove"
```

### 自動チェックスクリプト例

```bash
#!/bin/bash
# scripts/check-escalation-criteria.sh

set -e

echo "🔍 エスカレーション基準チェック開始..."

# 1. コスト見積もりチェック
ESTIMATED_COST=$(npx cdk synth --all 2>&1 | grep -oP 'Estimated.*\$\K[0-9]+' || echo "0")
if [ "$ESTIMATED_COST" -gt 1000 ]; then
  echo "❌ エスカレーション: 月額コスト $${ESTIMATED_COST} > $1,000"
  exit 1
fi

# 2. Security Group 0.0.0.0/0チェック
PUBLIC_SG=$(cat cdk.out/*.template.json | jq -r '.Resources | to_entries[] | select(.value.Type == "AWS::EC2::SecurityGroup") | select(.value.Properties.SecurityGroupIngress[]?.CidrIp == "0.0.0.0/0")' | wc -l)
if [ "$PUBLIC_SG" -gt 0 ]; then
  echo "❌ エスカレーション: インターネット公開Security Group検出"
  exit 1
fi

# 3. 暗号化未設定チェック
UNENCRYPTED_S3=$(cat cdk.out/*.template.json | jq -r '.Resources | to_entries[] | select(.value.Type == "AWS::S3::Bucket") | select(.value.Properties.BucketEncryption? == null)' | wc -l)
if [ "$UNENCRYPTED_S3" -gt 0 ]; then
  echo "❌ エスカレーション: 暗号化未設定のS3バケット検出"
  exit 1
fi

# 4. マルチリージョンチェック
REGION_COUNT=$(cat cdk.out/*.template.json | jq -r '.Resources | to_entries[].value.Properties | select(.Region?) | .Region' | sort -u | wc -l)
if [ "$REGION_COUNT" -gt 1 ]; then
  echo "❌ エスカレーション: マルチリージョン構成検出"
  exit 1
fi

# 5. Lambda同時実行数チェック
LAMBDA_COUNT=$(cat cdk.out/*.template.json | jq '[.Resources | to_entries[] | select(.value.Type == "AWS::Lambda::Function")] | length')
if [ "$LAMBDA_COUNT" -gt 800 ]; then
  echo "❌ エスカレーション: Lambda関数数 $LAMBDA_COUNT > 800（同時実行数制限リスク）"
  exit 1
fi

# 6. 破壊的変更チェック
if npx cdk diff --fail --quiet 2>&1 | grep -E "Replacement|Delete"; then
  echo "❌ エスカレーション: 破壊的変更検出"
  exit 1
fi

echo "✅ エスカレーション基準チェック完了（問題なし）"
exit 0
```

### CI/CDでの自動チェック統合

```yaml
# .github/workflows/escalation-check.yml
name: Escalation Criteria Check

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npx cdk synth --all
      - run: bash scripts/check-escalation-criteria.sh
```

## チェックリスト

### 設計開始前
- [ ] 要件の明確化（機能、非機能、制約）
- [ ] Well-Architected Framework 5本柱の考慮
- [ ] コスト見積もり（予算内か確認）
- [ ] セキュリティ要件の特定
- [ ] コンプライアンス要件の確認

### 設計完了前
- [ ] ADR作成（主要な技術決定）
- [ ] Infrastructure Design Doc作成
- [ ] コスト見積もりの精緻化
- [ ] セキュリティチェックリストの完了
- [ ] ディザスタリカバリ戦略の定義
- [ ] 運用監視設計の完了

### 実装前
- [ ] 既存インフラとの整合性確認
- [ ] 依存関係の明確化
- [ ] デプロイ手順の文書化
- [ ] ロールバック手順の定義
