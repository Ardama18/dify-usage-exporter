---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 015
phase: 5
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: 最終検証

メタ情報:
- 依存:
  - task-api-meter-interface-update-phase5-002 → 成果物: ドキュメント更新
  - task-api-meter-interface-update-phase5-003 → 成果物: パフォーマンステスト完了
- 提供: 最終検証完了、ロールバックプラン
- サイズ: 小規模（手動検証）

## 実装内容

全テストの実行と品質チェックリストの確認を行い、本番環境への準備を整えます。

## 実施手順

### 1. 全テストの実行

```bash
# ユニットテスト・統合テスト実行
npm test

# カバレッジ測定（70%以上）
npm run test:coverage

# TypeScriptビルド
npm run build

# Biomeチェック
npm run check
```

### 2. 品質チェックリストの確認

- [ ] 型安全性（any型なし、型チェック成功）
- [ ] テストカバレッジ70%以上
- [ ] 全テストがパス
- [ ] Biomeチェックがパス
- [ ] ドキュメントが最新

### 3. ロールバックプラン作成

```markdown
# ロールバックプラン

## 旧バージョンへの切り戻し手順

1. Gitで旧バージョンにrevert
   ```bash
   git revert <commit-hash>
   ```

2. 環境変数の復元
   - API_METER_TENANT_ID, API_METER_TOKEN, API_METER_URL を削除
   - 旧環境変数（X-API-Key等）を復元

3. 旧形式スプールファイルの保持確認
   - `data/spool/` に旧形式ファイルが残っていることを確認
   - 必要に応じて `data/failed/` から復元

4. 動作確認
   ```bash
   npm test
   npm run start -- --mode per_model --date 2025-12-05
   ```

## リスク評価

- 旧形式スプールファイルは自動変換されるため、ロールバック時にデータ欠損の可能性あり
- 変換前のファイルは `data/backup/` に保存推奨
```

### 4. 受入条件達成確認

- [ ] **AC-1**: プロバイダー名正規化（aws-bedrock → aws）
- [ ] **AC-2**: モデル名標準化（claude-3-5-sonnet → claude-3-5-sonnet-20241022）
- [ ] **AC-3**: トークン計算検証（total_tokens = input_tokens + output_tokens）
- [ ] **AC-4**: Bearer Token認証（Authorization: Bearer {API_METER_TOKEN}）
- [ ] **AC-5**: source_event_id生成（決定論的ID生成）
- [ ] **AC-6**: エラーハンドリング（429リトライ、5xxリトライ、400系スプール保存）
- [ ] **AC-7**: バッチサイズ管理（100-500レコード）
- [ ] **AC-8**: メタデータ充実化（source_system, source_event_id, aggregation_method）
- [ ] **AC-9**: 日付フォーマット標準化（YYYY-MM-DD, ISO8601）
- [ ] **AC-10**: コスト計算（cost_actual数値型、小数点以下7桁）
- [ ] **AC-11**: 統合テスト（Fetch → Aggregate → Normalize → Transform → Send）
- [ ] **AC-12**: API_Meter本番環境で検証済み（200 OK受信）

## 完了条件

- [ ] 全テストがパス
- [ ] テストカバレッジ70%以上
- [ ] 型チェック・ビルドが成功
- [ ] Biomeチェックがパス
- [ ] ロールバックプランが作成され、レビュー済み
- [ ] 全受入条件が達成されている
- [ ] L3（本番環境）レベルの最終確認完了

## 参考資料

- [Design Document](../design.md)
- [作業計画書](../plan.md)
