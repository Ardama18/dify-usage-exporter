# タスク: 品質チェック・最終確認

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 010
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-009 → 成果物: E2Eテスト完了
- 提供: 品質保証完了レポート
- サイズ: 小規模（チェックのみ）

## 実装内容

全ての品質チェックを実行し、受入条件（AC）を最終確認する。Design Docの全30件のACが満たされていることを検証し、Story 2を完了させる。

## 対象ファイル
- なし（チェックのみ）

## 実装手順

### 1. 品質チェックコマンド実行
- [ ] Biome lint + format チェック
  ```bash
  npm run check
  ```
- [ ] 未使用エクスポート検出
  ```bash
  npm run check:unused
  ```
- [ ] TypeScriptビルド
  ```bash
  npm run build
  ```
- [ ] カバレッジ測定
  ```bash
  npm run test:coverage:fresh
  ```

### 2. カバレッジレポート確認
- [ ] カバレッジが70%以上であることを確認
  ```bash
  open coverage/index.html
  ```
- [ ] 各ファイルのカバレッジ確認
  - src/types/dify-usage.ts
  - src/types/watermark.ts
  - src/interfaces/fetcher.ts
  - src/errors/dify-api-error.ts
  - src/watermark/watermark-manager.ts
  - src/fetcher/dify-api-client.ts
  - src/fetcher/dify-usage-fetcher.ts

### 3. Design Doc受入条件最終確認

#### FR-1: Dify API認証
- [ ] **AC-1-1**: 全リクエストにBearer Token
- [ ] **AC-1-2**: DIFY_API_TOKEN未設定エラー
- [ ] **AC-1-3**: 401エラー時ログ・終了

#### FR-2: 使用量データ取得API呼び出し
- [ ] **AC-2-1**: /console/api/usage呼び出し
- [ ] **AC-2-2**: パラメータ正しく設定
- [ ] **AC-2-3**: JSONレスポンス解析
- [ ] **AC-2-4**: タイムアウト30秒

#### FR-3: ページング処理
- [ ] **AC-3-1**: has_more継続取得
- [ ] **AC-3-2**: 1秒ディレイ
- [ ] **AC-3-3**: DIFY_FETCH_PAGE_SIZE反映
- [ ] **AC-3-4**: 100ページ進捗ログ

#### FR-4: ウォーターマーク管理
- [ ] **AC-4-1**: ウォーターマーク読み込み
- [ ] **AC-4-2**: 初回30日取得
- [ ] **AC-4-3**: 完了時ウォーターマーク更新
- [ ] **AC-4-4**: バックアップ作成
- [ ] **AC-4-5**: 破損時バックアップ復元
- [ ] **AC-4-6**: パーミッション600

#### FR-5: エラーハンドリング
- [ ] **AC-5-1**: リトライ（ネットワーク/5xx/429）
- [ ] **AC-5-2**: リトライなし（400/401/403/404）
- [ ] **AC-5-3**: Retry-After対応
- [ ] **AC-5-4**: 構造化ログ
- [ ] **AC-5-5**: エラー時ウォーターマーク更新

#### FR-6: データバリデーション
- [ ] **AC-6-1**: zodスキーマ検証
- [ ] **AC-6-2**: 必須フィールド確認
- [ ] **AC-6-3**: バリデーションエラー時スキップ
- [ ] **AC-6-4**: トークン数検証

#### 非機能要件
- [ ] **AC-NF-1**: 10,000件を30秒以内
- [ ] **AC-NF-2**: メモリ100MB以内
- [ ] **AC-NF-3**: 重複取得率0%
- [ ] **AC-NF-4**: APIトークン非出力

### 4. 最終品質確認
- [ ] 全体統合チェック実行
  ```bash
  npm run check:all
  ```
- [ ] エラーがないことを確認

### 5. ドキュメント更新（必要に応じて）
- [ ] README.mdの更新（新機能の説明）
- [ ] .env.exampleの更新（新環境変数）
- [ ] CHANGELOG.mdの更新（変更履歴）

## 完了条件
- [ ] 全品質チェックがパス
  ```bash
  npm run check:all
  ```
- [ ] カバレッジ70%以上達成
- [ ] 全30件の受入条件が満たされている
- [ ] lint/format/buildエラーなし
- [ ] Story 2完了

## 品質基準サマリー

| 項目 | 基準 | 確認方法 |
|------|------|----------|
| TypeScript | strict mode エラー0件 | `npm run build` |
| Lint | Biome エラー0件 | `npm run check` |
| 単体テスト | 全パス | `npm test` |
| 統合テスト | 59件パス | `npm test -- test/integration/` |
| E2Eテスト | 44件パス | `npm test -- test/e2e/` |
| カバレッジ | 70%以上 | `npm run test:coverage:fresh` |
| 受入条件 | 30件満たす | 手動確認 |

## 関連する受入条件（AC）
- 全AC（AC-1-1 〜 AC-NF-4）

## 依存タスク
- task-009: E2Eテスト実行

## 注意事項
- 影響範囲: Story 2全体の品質保証
- 制約: 全チェックがパスしないとStory 2は完了しない
- 次ステップ: Story 3（データ変換）への連携準備
