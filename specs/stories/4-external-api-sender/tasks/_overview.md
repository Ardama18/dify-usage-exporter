# 全体設計書: External API Sender

生成日時: 2025-01-21
対象計画書: specs/stories/4-external-api-sender/plan.md

## プロジェクトの全体像

### 目的とゴール
変換済み使用量データを外部APIへ確実に送信し、失敗時は自動リトライ・スプール保存することで、データ欠損を防ぎDownstream処理（コスト集計・課金）を安定化させる。

### 背景とコンテキスト
- Story 3（data-transformation）で変換されたデータを外部システムへ送信
- ネットワーク障害や外部APIの一時的な障害に対する耐障害性を確保
- 冪等性保証により重複送信を防止
- スプール機構により長期間の障害にも対応

## タスク分割の設計

### 分割方針
**垂直スライス（レイヤー単位で完結）**を採用

**理由:**
- HTTPクライアント層、スプール管理層、送信層が明確に分離
- 各レイヤーが独立してテスト可能
- 外部依存（外部API）をモックで代替し、早期に動作確認可能
- 技術的依存関係に基づく段階的実装（下位層から上位層へ）

**フェーズ構成:**
1. **Phase 0**: セットアップと共通型定義（0.5日）- 基盤準備
2. **Phase 1**: HTTPクライアント層（2-3日）- axios + axios-retry
3. **Phase 2**: スプール管理層（2-3日）- ファイル保存・読み込み
4. **Phase 3**: 送信層統合（3-4日）- Sender統合
5. **Phase 4**: エラー通知統合（1-2日）- INotifier連携
6. **Phase 5**: メトリクス拡張と最終統合（1日）- 品質保証

### 確認可能性レベルの分布
- **L1（単体テスト実行）**: Phase 0, Phase 1（HttpClient単体）
- **L2（モジュール統合テスト）**: Phase 2（SpoolManager単体）
- **L3（E2Eシナリオテスト）**: Phase 3, Phase 4, Phase 5（全体統合）

### タスク間の関連マップ

```
Phase 0: セットアップ
  ├─ Task 0-1: 依存パッケージと型定義
  │   → 成果物: src/types/external-api.ts, src/types/spool.ts, src/interfaces/sender.ts
  └─ Phase 0完了タスク

Phase 1: HTTPクライアント層（Task 0-1の成果物を参照）
  ├─ Task 1-1: 環境変数定義と拡張
  │   → 成果物: src/config/env-config.ts（拡張）
  ├─ Task 1-2: HttpClientクラス実装（Task 1-1の成果物を参照）
  │   → 成果物: src/sender/http-client.ts
  ├─ Task 1-3: RetryPolicyユーティリティ実装（Task 1-2と統合）
  │   → 成果物: src/sender/retry-policy.ts
  └─ Phase 1完了タスク

Phase 2: スプール管理層（Task 0-1の型定義を参照）
  ├─ Task 2-1: ファイル操作ユーティリティ実装
  │   → 成果物: src/utils/file-utils.ts
  ├─ Task 2-2: SpoolManagerクラス実装（Task 2-1を利用）
  │   → 成果物: src/sender/spool-manager.ts
  └─ Phase 2完了タスク

Phase 3: 送信層統合（Phase 1, 2の成果物を統合）
  ├─ Task 3-1: ExternalApiSenderクラス実装
  │   → 成果物: src/sender/external-api-sender.ts
  ├─ Task 3-2: 統合テスト作成（E2Eフロー）
  │   → 成果物: src/sender/__tests__/integration/sender-e2e.int.test.ts
  └─ Phase 3完了タスク

Phase 4: エラー通知統合（Phase 3の成果物を拡張）
  ├─ Task 4-1: INotifierインターフェース定義とモック実装
  │   → 成果物: src/interfaces/notifier.ts, src/notifier/console-notifier.ts
  ├─ Task 4-2: data/failed/移動時の通知送信実装
  │   → 成果物: src/sender/external-api-sender.ts（拡張）
  └─ Phase 4完了タスク

Phase 5: メトリクス拡張と最終統合
  ├─ Task 5-1: ExecutionMetrics型拡張
  │   → 成果物: src/types/metrics.ts（拡張）
  ├─ Task 5-2: 最終統合テストと品質保証
  └─ Phase 5完了タスク
```

### インターフェース変更の影響分析

| 既存インターフェース | 新インターフェース | 変換必要性 | 対応タスク |
|---------------------|-------------------|-----------|-----------|
| なし（新規） | ISender | なし | Task 0-1 |
| なし（新規） | INotifier | なし | Task 4-1 |
| TransformerのExternalApiRecord[] | SenderのExternalApiRecord[] | なし（型共有） | Task 0-1 |
| 既存env-config | 拡張env-config（EXTERNAL_API_*） | なし（後方互換） | Task 1-1 |
| 既存ExecutionMetrics | 拡張ExecutionMetrics | なし（後方互換） | Task 5-1 |

### 共通化ポイント

**共通型定義（Phase 0）:**
- ExternalApiRecord型: Story 3と共有
- SpoolFile型: zodスキーマ含む
- ISenderインターフェース: 送信処理の抽象化

**共通ユーティリティ（Phase 2）:**
- file-utils.ts: パーミッション600設定、アトミック書き込み
- 他の機能（スプール、ログ保存）でも再利用可能

**リトライロジック（Phase 1）:**
- RetryPolicy: 指数バックオフロジック
- 将来的に他のHTTP通信でも再利用可能

## 実装時の注意事項

### 全体を通じて守るべき原則

1. **テストファースト（TDD）**: Red-Green-Refactorサイクルを厳守
2. **外部依存のモック化**: 外部API、ファイルシステムをモックで代替
3. **セキュリティ**: HTTPS必須、トークンマスキング、パーミッション600
4. **冪等性保証**: バッチ冪等キー（SHA256）による重複検出
5. **エラーハンドリング**: リトライ対象/非対象の明確な区別

### リスクと対策

**リスク1: 外部APIの長期停止（1日以上）**
- **影響度**: 高
- **対策**: スプール機構で最大7日間保持、data/failed/で永久保存

**リスク2: スプールファイルの破損**
- **影響度**: 中
- **対策**: zodバリデーション、破損時はdata/failed/へ移動

**リスク3: 環境変数の誤設定**
- **影響度**: 高
- **対策**: 起動時バリデーション、必須項目チェック

**リスク4: 認証トークンの有効期限切れ**
- **影響度**: 高
- **対策**: 401エラー時に即座にログ出力、将来的にリフレッシュロジック追加

### 影響範囲の管理

**変更が許可される範囲:**
- `src/sender/` ディレクトリ（新規作成）
- `src/notifier/` ディレクトリ（新規作成）
- `src/interfaces/sender.ts`, `src/interfaces/notifier.ts`（新規作成）
- `src/types/external-api.ts`, `src/types/spool.ts`（新規作成）
- `src/utils/file-utils.ts`（新規作成）
- `src/config/env-config.ts`（拡張）
- `src/types/metrics.ts`（拡張）

**変更禁止エリア:**
- `src/fetcher/`（Story 2の責務）
- `src/transformer/`（Story 3の責務、ただしSender.send()呼び出しは追加可）
- `src/scheduler/`（Story 1の責務）
- `src/logger/`（Story 1の責務）

**依存関係の境界:**
- Senderは Transformer からデータを受け取るのみ（逆方向依存なし）
- Senderは INotifier を呼び出すのみ（実装はStory 5）
- Senderは Logger、EnvConfig を利用（Story 1で提供）

## 品質保証方針

### テストカバレッジ目標
- 単体テスト: 70%以上（必須）
- 統合テスト: 主要フロー（送信→リトライ→スプール→再送）を完全カバー
- E2Eテスト: エラーシナリオ（タイムアウト、429、400、401）を完全カバー

### 動作確認レベル
- **L1（Phase 0, 1）**: TypeScriptビルド、単体テスト実行
- **L2（Phase 2）**: スプールファイル保存・読み込み確認
- **L3（Phase 3, 4, 5）**: E2Eシナリオテスト、全体統合テスト

### 最終確認項目（Phase 5）
1. 全テスト実行: `npm test`
2. カバレッジ確認: `npm run test:coverage:fresh`（70%以上）
3. TypeScriptビルド: `npm run build`
4. Biomeチェック: `npm run check`
5. E2Eフロー確認: 送信成功、リトライ成功、スプール保存、スプール再送、data/failed/移動

## タスク実行時のチェックポイント

### 各タスク開始時
- [ ] 依存タスクの成果物を確認
- [ ] テスト実装から開始（Red Phase）
- [ ] 型定義の確認（any型禁止）

### 各タスク完了時
- [ ] 追加したテストが全てパス
- [ ] TypeScript strict mode: エラー0件
- [ ] Biome lint: エラー0件
- [ ] 動作確認完了（L1/L2/L3）
- [ ] 成果物の明示的な記録

### フェーズ完了時
- [ ] フェーズ内の全タスクが完了
- [ ] フェーズ完了タスクの実行（plan.mdチェックボックス確認）
- [ ] 次フェーズへの引き継ぎ準備（成果物の整理）

## 参考資料

- Epic方針書: `specs/epics/1-dify-usage-exporter/epic.md`
- PRD: `specs/stories/4-external-api-sender/prd.md`
- Design Doc: `specs/stories/4-external-api-sender/design.md`
- 作業計画書: `specs/stories/4-external-api-sender/plan.md`
- ADR 001-007: `specs/adr/001-spool-file-format.md` 〜 `specs/adr/007-http-client-library.md`
