---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "014"
phase: 4
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: 品質保証

メタ情報:
- 依存:
  - task-013: E2Eテスト実行
- 提供: 全テスト・lint・型チェックパス
- サイズ: 確認作業のみ

## 確認内容

全テスト・lint・型チェックが通ることを確認し、受入条件を全て達成する。

## 確認手順

### 1. 全テスト実行
```bash
npm run test:safe
```

### 2. 品質チェック
```bash
npm run check
npm run build
```

### 3. カバレッジ確認（オプション）
```bash
npm run test:coverage:fresh
```

## 完了条件

### テスト要件
- [x] 全統合テストパス（93件）
  - src/cli/__tests__/integration/list-command.int.test.ts: 16件
  - src/cli/__tests__/integration/resend-command.int.test.ts: 36件
  - src/cli/__tests__/integration/watermark-command.int.test.ts: 28件
  - src/cli/__tests__/integration/common.int.test.ts: 13件
- [x] 全E2Eテストパス（26件）
  - src/cli/__tests__/e2e/cli-commands.e2e.test.ts: 26件
- [x] 全単体テストパス

### 品質基準
- [x] npm run check 通過（Biome lint + format）
- [x] npm run build 成功（TypeScriptビルド）

### 受入条件の全チェック

#### resendコマンド（6件）
- [x] AC-RESEND-1: 引数なし実行でファイル一覧表示
- [x] AC-RESEND-2: --fileオプションで指定ファイル再送
- [x] AC-RESEND-3: --allオプションで全ファイル再送
- [x] AC-RESEND-4: 再送成功時にファイル削除
- [x] AC-RESEND-5: 再送失敗時にエラー表示・ファイル保持
- [x] AC-RESEND-6: 処理後にサマリー表示

#### watermarkコマンド（6件）
- [x] AC-WM-1: showでlast_fetched_date/last_updated_at表示
- [x] AC-WM-2: ファイル未存在時に「未設定」表示
- [x] AC-WM-3: reset時に確認プロンプト表示
- [x] AC-WM-4: 確認「y」でウォーターマークリセット
- [x] AC-WM-5: 確認「y」以外でリセットキャンセル
- [x] AC-WM-6: 不正日時形式でエラー・exit 1

#### listコマンド（4件）
- [x] AC-LIST-1: 全ファイル一覧表示
- [x] AC-LIST-2: 各ファイルの詳細情報表示
- [x] AC-LIST-3: 空ディレクトリで「No failed files」表示
- [x] AC-LIST-4: 合計ファイル数・レコード数表示

#### 共通（3件）
- [x] AC-COMMON-1: 全コマンドで--helpオプション提供
- [x] AC-COMMON-2: 未知コマンドでエラー・ヘルプ表示
- [x] AC-COMMON-3: 成功時exit 0、エラー時exit 1

### 合計: 19件のAC全て達成

## 注意事項
- 影響範囲: 全体品質確認
- 制約: 全Phase完了後の最終確認
- 品質基準を満たさない場合は該当タスクに戻って修正

## ACトレーサビリティ
- 全AC（最終確認）
