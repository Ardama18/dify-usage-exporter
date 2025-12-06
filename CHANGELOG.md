# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-06

### Breaking Changes

- **API_Meter 新仕様（2025-12-04版）への完全移行**
  - ExternalApiRecord → ApiMeterRequest への型システム完全置き換え
  - X-API-Key 認証 → Bearer Token 認証への変更
  - 環境変数の変更: `EXTERNAL_API_KEY` → `API_METER_TOKEN`
  - 環境変数の追加: `API_METER_TENANT_ID`, `API_METER_URL`
  - per_user/per_app/workspace モードは API_Meter 統合でサポート外（ローカル集計のみ）

### Added

- **正規化層の導入**（ADR 013）
  - プロバイダー名の標準化（aws-bedrock → aws, claude → anthropic 等）
  - モデル名の標準化（公式識別子への変換）
  - データフローに Normalize ステップを追加
- **source_event_id による冪等性機構**（ADR 016）
  - SHA256 ハッシュベースの決定論的 ID 生成
  - リトライ時の重複送信を完全に防止
  - フォーマット: `dify-{usage_date}-{provider}-{model}-{hash12}`
- **旧形式スプールファイルの自動変換機能**（ADR 018）
  - 読み込み時に旧形式（ExternalApiRecord）→ 新形式（ApiMeterRequest）へ自動変換
  - データ保全を維持しながら段階的移行を実現
  - 変換失敗時は `data/failed/` へ移動
- **日別データのフィルタリング機能**（ADR 019）
  - API_Meter は日別データのみ送信（aggregation_period: "daily" 固定）
  - 月別・週別データはローカル集計のみ（API_Meter へは送信しない）
  - DIFY_AGGREGATION_PERIOD="daily" を推奨

### Changed

- **Bearer Token 認証への移行**（ADR 014）
  - API_Meter への送信時に Bearer Token を使用
  - Authorization ヘッダー: `Bearer {API_METER_TOKEN}`
- **リトライ条件の明確化**（ADR 017）
  - リトライ対象: 429（Rate Limit）、5xx（Server Error）、ネットワークエラー
  - リトライしない: 4xx（400, 401, 403, 404, 422）
  - 409 Conflict は返されない（API_Meter 内部で UPSERT 処理）
  - 常に 200 OK を返す（inserted/updated でINSERT/UPDATE を判別）
- **データフローの変更**（ADR 015）
  - 既存: Fetch → Aggregate → Transform → Send
  - 新規: Fetch → Aggregate → **Normalize** → Transform → Send
  - 正規化層を集計後、変換前に配置
- **型システムの完全置き換え**（ADR 014）
  - `ExternalApiRecord` → `ApiMeterUsageRecord` へ全面移行
  - `externalApiRecordSchema` → `apiMeterUsageRecordSchema` へ移行
  - トップレベル構造: tenant_id + export_metadata + records

### Fixed

- **トークン計算検証の追加**
  - total_tokens = input_tokens + output_tokens の検証ロジックを実装
  - zod refine メソッドでランタイムバリデーション
- **エラーハンドリングの改善**
  - ステータスコード別のエラーメッセージ詳細化
  - Retry-After ヘッダーの尊重
  - 指数バックオフ（1s → 2s → 4s）の実装

### Deprecated

- `ExternalApiRecord` 型（`src/types/external-api.ts`）
  - 新規実装では `ApiMeterUsageRecord` を使用してください
  - 旧形式スプールファイルのサポートは継続（自動変換）

### Implementation Details

- **ADR 013**: 正規化層の導入（プロバイダー名・モデル名の標準化）
- **ADR 014**: 型システムの完全置き換え（ExternalApiRecord → ApiMeterRequest）
- **ADR 015**: データフロー変更（Normalize ステップの追加）
- **ADR 016**: 冪等性機構（source_event_id 生成ロジック）
- **ADR 017**: エラーハンドリング戦略（リトライ条件の明確化）
- **ADR 018**: スプール機構統合（旧形式スプールファイルの自動変換）
- **ADR 019**: 日別集計の実装（aggregation_period: "daily" 固定）

## [1.0.0] - 2025-11-30

### Added

- **初回リリース**
  - Dify API からの使用量データ取得
  - 複数の集計モード（per_model/per_user/per_app/workspace/all）
  - 外部API への送信機能
  - スプールファイル機構（送信失敗時の保存とリトライ）
  - cron によるスケジュール実行
  - CLI インターフェース

### Features

- **集計機能**
  - モデル別集計（per_model）
  - ユーザー別集計（per_user）
  - アプリ別集計（per_app）
  - ワークスペース全体集計（workspace）
  - 全集計モード（all）
- **送信機能**
  - 外部API への送信
  - リトライ機能（最大3回）
  - 指数バックオフ
  - スプールファイル保存
- **スケジュール実行**
  - cron 形式でのバッチ実行
  - 日次・週次・月次の集計周期

[1.1.0]: https://github.com/your-repo/dify-usage-exporter/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your-repo/dify-usage-exporter/releases/tag/v1.0.0
