---
description: インフラ実装の完全サイクル管理（要件分析→設計→計画→CDK実装→検証）
---
**コマンドコンテキスト**: インフラ実装の完全サイクル管理（要件分析→Infrastructure設計→計画→CDK実装→品質検証）

ultrathink

## 初回必須タスク

作業開始前に以下のルールファイルを必ず読み込み、厳守してください：
- @.claude/steering/core-principles.md - 全エージェント共通原則（タスク管理、品質基準、エラー対応）
- @.claude/steering/sub-agents.md - サブエージェント管理フロー
- @.claude/steering/infrastructure-requirements.md - インフラ要件定義ガイドライン
- @.claude/steering/cdk-best-practices.md - CDK実装ベストプラクティス

## 実行判断フロー

### 1. 現在状況の判定
指示内容: $ARGUMENTS

現在の状況を判定：

| 状況パターン | 判定基準 | 次のアクション |
|------------|---------|-------------|
| 新規インフラ要件 | 既存インフラドキュメントなし、新しいインフラ構築依頼 | requirement-analyzerから開始 |
| フロー継続 | 既存インフラドキュメント/タスクあり、継続指示 | インフラフローで次のステップを特定 |
| 品質エラー | CDK Synthエラー、cfn-nag違反、テスト失敗 | infrastructure-validator実行 |
| 不明瞭 | 意図が曖昧、複数の解釈が可能 | ユーザーに確認 |

### 2. 継続時の進捗確認
フロー継続の場合、以下を確認：
- 最新の成果物（要件定義書/Infrastructure ADR/Infrastructure Design Doc/作業計画書/タスク）
- 現在のフェーズ位置（要件/設計/計画/CDK実装/検証）
- インフラフローの該当ステップを特定

### 3. 次のアクション実行

**インフラ実装フロー**：
1. requirement-analyzer: 要件分析・規模判定
2. infrastructure-designer: Infrastructure ADR・Design Doc作成
3. work-planner: 作業計画書作成
4. task-decomposer: タスク分解
5. cdk-implementer: CDK実装・Unit Test
6. infrastructure-validator: セキュリティ・コンプライアンス検証、Integration Test

## 📋 インフラ実装フローの実行

**実行前チェック（必須）**：
- [ ] インフラ要件を明確にした
- [ ] AWS Well-Architected Framework 5本柱を考慮した
- [ ] セキュリティ・コスト・スケーラビリティ要件を確認した
- [ ] 現在の進捗位置を特定した
- [ ] 次のステップを明確にした
- [ ] タスク実行後の検証サイクルを理解した

**フロー逸脱禁止**: 定義されたインフラフローから外れることは禁止。

## 🎯 オーケストレーターとしての必須責務

### タスク実行時の品質サイクル管理
**絶対的ルール**：cdk-implementer実行後は必ず以下を実行
1. git commit実行（Bashツール使用）
2. infrastructure-validator実行（セキュリティ・コンプライアンス検証）
3. 全検証合格確認
4. 次タスクの実行または完了報告

**省略禁止**：このサイクルを省略した場合、インフラ品質を保証できない

### Infrastructure Design Doc情報の伝達
infrastructure-designer実行後、work-planner呼び出し時には以下を伝達：
- 生成されたInfrastructure ADRファイルパス
- 生成されたInfrastructure Design Docファイルパス
- CDKスタック構成
- 環境別設定要件

### Integration Test情報の伝達
work-planner呼び出し時には以下を明示：
- Unit TestはCDK実装と同時実行
- Integration Testは全CDK実装後にinfrastructure-validatorが実行
- cfn-nag、cdk-nagによるセキュリティ検証

## 責務境界

**本コマンドの責務**: オーケストレーターとしてインフラ専門サブエージェントを適切に振り分け、完全サイクルを管理
**責務外**: 自身でのCDK実装作業、調査作業（Grep/Glob/Read等）

---

## インフラ実装専門原則（オーケストレーター・実装エージェント向け）

### 🚨 最重要原則：調査OK、実装STOP

**すべてのEdit/Write/MultiEditツール使用前にユーザー承認が必須**

理由：ユーザーの意図と異なるインフラ実装を防ぎ、正しい方向性を確保するため

### 実装実行プロセス

#### 実行フロー（必須手順）
1. **TodoWriteでタスク分解** → なければ実装ステップに進めない
2. **Edit/Write/MultiEdit使用** → ユーザー承認が必須
3. **CDK実装実行** → 品質チェックエラーは完了条件を満たさない
4. **セキュリティ検証** → cfn-nag、cdk-nag合格必須

#### TodoWriteと実装の統合
**実行ルール**：
- TodoWriteなしでEditツール使用: ルール違反として停止
  理由：タスク管理なしでは進捗追跡と品質保証ができないため

#### 実装前提条件
1. **TodoWriteのタスク** → in_progressステータスが存在すること
2. **ユーザー承認記録** → Edit/Write前に明示的承認があること
3. **品質チェック結果** → エラー0でなければ完了不可

#### 禁止事項（実装時）
- **TodoWriteなしのEdit使用** → ルール違反
- **承認なしEdit/Write/MultiEdit** → 承認待ちに移行
- **品質エラー残存での完了宣言** → 完了条件を満たさない
- **セキュリティベストプラクティス違反** → cfn-nag, cdk-nag合格必須

### 実装時の行動制御（失敗防止）

#### 自動停止トリガー（必ず停止）
- **5ファイル以上の変更検出**：即座停止、影響範囲をユーザーに報告
  理由：大規模変更は事前計画とレビューが必要なため
- **3ファイル編集完了**: TodoWriteの更新を強制（更新しないと次のEditツール使用不可）
  理由：進捗確認と方向性の再確認が必要なため

#### エラー修正衝動対処
1. エラー発見 → **一時停止**
2. 根本原因分析（なぜ？を5回繰り返して真因を特定）
3. 対処計画提示
4. ユーザー承認後に修正

#### 集中時のルール無視防止
**測定可能な強制停止基準**：
- **連続エラー修正2回目**: 一時停止し、根本原因分析を実施
- **Editツール5回使用**: 影響範囲レポートの作成を強制
- **同一ファイル3回編集**: リファクタリング検討の強制停止

### インフラ品質チェックの責務分担

#### 各タスク実行時
cdk-implementerがtasksファイルの完了条件に従って基本品質チェック実行：
- TypeScript strict mode: エラー0件
- Biome lint: エラー0件
- CDK Synth: 成功
- Unit Test: すべてパス

#### 最終タスク実行時
infrastructure-validatorがプロジェクト全体品質チェック実行：
- オーケストレーターが最終Phaseの最終タスクで呼び出し
- cfn-nag: セキュリティ検証合格
- cdk-nag: コンプライアンス検証合格
- Integration Test: 実環境動作確認合格
- プロジェクト全体の統合品質を保証

## AWS Well-Architected Framework準拠

すべてのインフラ実装は以下の5本柱を考慮：
1. **運用の優秀性**: 監視・自動化・運用効率化
2. **セキュリティ**: IAM最小権限・暗号化・監査ログ
3. **信頼性**: Multi-AZ・バックアップ・DR設計
4. **パフォーマンス効率**: スケーリング・キャッシング・最適化
5. **コスト最適化**: リソースサイジング・ライフサイクル管理

## セキュリティ必須要件

- [ ] IAM最小権限の原則
- [ ] S3/RDS/DynamoDB保管時暗号化
- [ ] 通信のTLS 1.2以上
- [ ] Security Group最小化（0.0.0.0/0はポート80/443のみ）
- [ ] Secrets Manager使用（平文禁止）
- [ ] CloudTrail有効化
- [ ] VPC Flow Logs有効化（本番環境）

## コスト最適化必須要件

- [ ] 環境別リソースサイジング（dev < staging < prod）
- [ ] 開発環境の自動停止設定
- [ ] S3ライフサイクルポリシー設定
- [ ] RDS/DynamoDB Auto Scaling設定
- [ ] Reserved Instances/Savings Plans検討（本番環境）
- [ ] AWS Budget Alarms設定

## 信頼性必須要件（本番環境）

- [ ] RDS Multi-AZ配置
- [ ] ECS/Lambda Multi-AZ配置
- [ ] ALB/NLB Multi-AZ配置
- [ ] 自動バックアップ有効化
- [ ] RTO/RPO定義
- [ ] DR戦略定義
