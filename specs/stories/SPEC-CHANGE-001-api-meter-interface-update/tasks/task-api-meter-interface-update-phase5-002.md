---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 013
phase: 5
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: ドキュメント更新

メタ情報:
- 依存: task-api-meter-interface-update-phase5-001 → 成果物: コードレビュー完了
- 提供: README.md, CHANGELOG.md, ADR更新
- サイズ: 小規模（3ファイル）

## 実装内容

ドキュメントを最新の状態に更新します。

### 更新対象
1. README.md - 環境変数セクション、使用方法の更新
2. ADRのステータス更新（ADR 013-019を`Proposed` → `Accepted`）
3. CHANGELOG.md - バージョン1.1.0のリリースノート作成

## 対象ファイル

- [ ] README.md（更新）
- [ ] specs/adr/013-019-*.md（ステータス更新）
- [ ] CHANGELOG.md（更新）

## 実施手順

### 1. README.md の更新

```markdown
## 環境変数

| 変数名 | 説明 | 必須 | 形式 |
|-------|------|-----|------|
| API_METER_TENANT_ID | API_MeterのテナントID | ✓ | UUID |
| API_METER_TOKEN | API_MeterのBearer Token | ✓ | 文字列 |
| API_METER_URL | API_MeterのエンドポイントURL | ✓ | URL |

## 使用方法

### per_modelモード（推奨）
```bash
npm run start -- --mode per_model --date 2025-12-05
```

### allモード
```bash
npm run start -- --mode all --date 2025-12-05
```

注: per_user/per_app/workspaceモードはAPI_Meter統合ではサポートされていません。
```

### 2. ADRのステータス更新

各ADR（013-019）のヘッダーを更新:
```markdown
- Status: Accepted
- Date: 2025-12-05
- Implemented in: v1.1.0
```

### 3. CHANGELOG.md の更新

```markdown
## [1.1.0] - 2025-12-05

### Breaking Changes
- API_Meter新仕様（2025-12-04版）への完全移行
- ExternalApiRecord → ApiMeterRequestへの型システム完全置き換え
- X-API-Key認証 → Bearer Token認証への変更

### Added
- 正規化層の導入（プロバイダー名/モデル名の標準化）
- source_event_id による冪等性機構
- 旧形式スプールファイルの自動変換機能
- 日別データのフィルタリング機能

### Changed
- Bearer Token認証への移行
- リトライ条件の明確化（ADR 017準拠）
- データフロー: Aggregate → Normalize → Transform → Send

### Fixed
- トークン計算検証の追加
```

## 完了条件

- [ ] README.mdが更新され、最新の状態
- [ ] ADRのステータスが `Accepted` に変更されている
- [ ] CHANGELOG.mdが更新されている
- [ ] ドキュメントの整合性が確認されている

## 参考資料

- [Design Document](../design.md)
- [ADR 013-019](../../adr/)
