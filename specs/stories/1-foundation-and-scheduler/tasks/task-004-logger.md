---
story_id: "1"
title: foundation-and-scheduler
feature: foundation
task_number: "004"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: ログ出力基盤実装と統合テスト作成

メタ情報:
- 依存: task-003 → 成果物: src/config/env-config.ts
- 提供: src/logger/winston-logger.ts（Logger インターフェース、createLogger関数）
- サイズ: 中規模（実装1ファイル + テスト追記）

## 実装内容

winstonを使用したJSON形式ログ出力基盤を実装する。Loggerインターフェースを定義し、createLogger()関数でwinstonロガーをラップしたインスタンスを返す。child()メソッドによるメタデータ継承もサポート。

## 対象ファイル

- [x] src/logger/winston-logger.ts
- [x] test/integration/foundation-and-scheduler.int.test.ts（AC-LOG部分追記）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] ディレクトリ作成
  ```bash
  mkdir -p src/logger
  ```
- [x] 統合テストの追記（AC-LOG-1〜5）
  - AC-LOG-1: JSON Lines形式での標準出力（4件）
  - AC-LOG-2: ログフィールドの含有（5件）
  - AC-LOG-3: 4つのログレベルサポート（7件）
  - AC-LOG-4: エラーログのスタックトレース（3件）
  - AC-LOG-5: シークレット情報の非出力（3件）
  - Logger子インスタンス（2件）
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:integration
  ```

### 2. Green Phase

- [x] Loggerインターフェースの定義
  ```typescript
  export interface Logger {
    error(message: string, meta?: Record<string, unknown>): void
    warn(message: string, meta?: Record<string, unknown>): void
    info(message: string, meta?: Record<string, unknown>): void
    debug(message: string, meta?: Record<string, unknown>): void
    child(meta: Record<string, unknown>): Logger
  }
  ```

- [x] createLogger()関数の実装（Design Doc準拠）
  ```typescript
  export function createLogger(config: EnvConfig): Logger {
    const winstonLogger = winston.createLogger({
      level: config.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'dify-usage-exporter',
        env: config.NODE_ENV,
      },
      transports: [
        new winston.transports.Console(),
      ],
    })

    return wrapWinstonLogger(winstonLogger)
  }
  ```

- [x] wrapWinstonLogger()関数の実装
  ```typescript
  function wrapWinstonLogger(winstonLogger: winston.Logger): Logger {
    return {
      error: (message, meta) => winstonLogger.error(message, meta),
      warn: (message, meta) => winstonLogger.warn(message, meta),
      info: (message, meta) => winstonLogger.info(message, meta),
      debug: (message, meta) => winstonLogger.debug(message, meta),
      child: (meta) => wrapWinstonLogger(winstonLogger.child(meta)),
    }
  }
  ```

- [x] テスト実行して通ることを確認

### 3. Refactor Phase

- [x] コード改善（テストが通る状態を維持）
- [x] `npm run check` でlint/formatエラーなし

## テストケース詳細

### AC-LOG-1: JSON Lines形式での標準出力（4件）
- ログ出力がJSON形式
- 各ログが1行で出力される
- 複数ログが改行区切り
- JSON.parse()で正常にパース可能

### AC-LOG-2: ログフィールドの含有（5件）
- timestamp（ISO 8601形式）を含む
- levelを含む
- messageを含む
- serviceフィールドを含む
- envフィールドを含む

### AC-LOG-3: 4つのログレベルサポート（7件）
- errorレベルの出力
- warnレベルの出力
- infoレベルの出力
- debugレベルの出力
- LOG_LEVEL=errorでdebugが出力されない
- LOG_LEVEL=infoでdebugが出力されない
- LOG_LEVEL=debugで全レベル出力

### AC-LOG-4: エラーログのスタックトレース（3件）
- Errorオブジェクト渡しでスタックトレース出力
- スタックトレースがstackフィールドに含まれる
- エラーメッセージがerror/messageフィールドに含まれる

### AC-LOG-5: シークレット情報の非出力（3件）
- DIFY_API_TOKENがログに含まれない
- EXTERNAL_API_TOKENがログに含まれない
- 意図的にシークレットを渡しても出力されない

### Logger子インスタンス（2件）
- child()で子ロガー作成
- 子ロガーがメタデータを継承

## 完了条件

- [x] 追加したテストが全てパス（24件）
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [x] ログオーバーヘッド5%以内（パフォーマンス要件）
- [x] トレーサビリティ: AC-LOG-1（4件）、AC-LOG-2（5件）、AC-LOG-3（7件）、AC-LOG-4（3件）、AC-LOG-5（3件）、子インスタンス（2件）

## 注意事項

- **影響範囲**: scheduler、shutdown、index.tsが依存
- **制約**: Design Docのインターフェースに完全準拠
- **シークレット保護**: ログ関数はシークレットをフィルタリングしないため、呼び出し側でシークレットを渡さないこと
- **タイムスタンプ形式**: ISO 8601形式（YYYY-MM-DDTHH:mm:ss.SSSZ）
- **テスト考慮**: stdout出力をキャプチャしてJSON検証
