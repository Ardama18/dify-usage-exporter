# 全体設計書: 基盤とスケジューラ

生成日時: 2025-11-20
対象計画書: specs/stories/1-foundation-and-scheduler/plan.md

## プロジェクトの全体像

### 目的とゴール
Dify使用量エクスポートシステムの基盤となるTypeScript/Node.js実行環境を構築し、以下の機能を実現する：
- 環境変数管理（Zodによる型安全な検証）
- ログ出力基盤（winstonによるJSON形式出力）
- 定期実行スケジューラ（cronパッケージによる定期実行）
- Graceful Shutdown（SIGINT/SIGTERM対応）
- Docker対応（マルチステージビルド）

### 背景とコンテキスト
本ストーリーは後続ストーリー（Difyデータ取得、変換、外部API送信等）の基盤となる。全モジュールが本基盤を利用するため、堅牢な設計が必要。

## タスク分割の設計

### 分割方針
垂直スライスアプローチを採用。各モジュールが独立して動作可能であり、Phase 1でエントリーポイントから動作確認まで完結できる構造。

### 確認可能性レベルの分布
- Phase 1-3: L2（結合テスト）
- Phase 4: L3（E2Eテスト）

### タスク間の関連マップ

```
Phase 1: プロジェクト初期化・環境変数管理
├── task-001: プロジェクト初期化
│   └── 成果物: package.json, tsconfig.json, npm scripts
├── task-002: 型定義作成
│   └── 成果物: src/types/env.ts (EnvSchema, EnvConfig)
│   └── 依存: task-001
└── task-003: 環境変数管理実装
    └── 成果物: src/config/env-config.ts + 統合テスト
    └── 依存: task-002

Phase 2: ログ出力基盤
└── task-004: ログ出力基盤実装
    └── 成果物: src/logger/winston-logger.ts + 統合テスト
    └── 依存: task-003

Phase 3: スケジューラ・Graceful Shutdown
├── task-005: スケジューラ実装
│   └── 成果物: src/scheduler/cron-scheduler.ts + 統合テスト
│   └── 依存: task-004
├── task-006: Graceful Shutdown実装
│   └── 成果物: src/shutdown/graceful-shutdown.ts + 統合テスト
│   └── 依存: task-005
└── task-007: エントリーポイント実装
    └── 成果物: src/index.ts + 統合テスト
    └── 依存: task-006

Phase 4: Docker対応・最終統合
├── task-008: Docker対応
│   └── 成果物: Dockerfile, .dockerignore
│   └── 依存: task-007
├── task-009: 最終統合テストと品質チェック
│   └── 成果物: 全統合テスト通過、品質チェック完了
│   └── 依存: task-008
└── task-010: E2Eテスト実行
    └── 成果物: 全E2Eテスト通過
    └── 依存: task-009
```

### インターフェース変更の影響分析

本プロジェクトは新規作成のため、既存インターフェースへの影響はない。

後続ストーリーへの提供インターフェース：
| 提供インターフェース | 提供先 | 用途 |
|-------------------|--------|------|
| EnvConfig型 | 全モジュール | 設定値の型安全なアクセス |
| Logger インターフェース | 全モジュール | ログ出力 |
| Scheduler インターフェース | index.ts | ジョブ実行制御 |
| setupGracefulShutdown() | index.ts | シグナルハンドリング |

### 共通化ポイント

- **EnvConfig型**: 全モジュールで参照される環境変数の型定義
- **Logger インターフェース**: 全モジュールで使用されるログ出力の抽象化
- **generateExecutionId()**: ジョブ実行の一意識別子生成（scheduler内部で使用）

## 実装時の注意事項

### 全体を通じて守るべき原則

1. **TDD（Red-Green-Refactor）**: 各タスクでテストファーストを徹底
2. **Design Doc準拠**: インターフェース定義はDesign Docに完全準拠
3. **型安全性**: any型禁止、unknown型と型ガードで処理
4. **Fail-Fast原則**: フォールバック処理は最小限に

### リスクと対策

- **リスク**: 環境変数スキーマの設計ミス
  **対策**: Design Docの型定義を厳密に実装、テストで検証

- **リスク**: cronパッケージの動作不安定
  **対策**: 公式ドキュメント準拠、タイムゾーン明示指定

- **リスク**: Graceful Shutdownタイムアウト
  **対策**: デフォルト30秒で十分な余裕確保

### 影響範囲の管理

- **変更が許可される範囲**: src/, test/, Dockerfile, package.json, tsconfig.json
- **変更禁止エリア**: specs/（ドキュメント）は参照のみ

## テスト戦略

### 統合テストファイル
`test/integration/foundation-and-scheduler.int.test.ts`

### テスト件数内訳
| フェーズ | 件数 | 内容 |
|---------|------|------|
| Phase 1 | 22件 | AC-ENV-1〜5 |
| Phase 2 | 24件 | AC-LOG-1〜5 + 子インスタンス |
| Phase 3 (scheduler) | 28件 | AC-SCHED-1〜7 + その他 |
| Phase 3 (shutdown) | 18件 | AC-SHUT-1〜7 + 停止確認 |
| Phase 3 (entry) | 6件 | 正常起動 + エラーハンドリング |
| Phase 4 (Docker) | 14件 | AC-DOCKER-1〜3 |
| **合計** | **112件** | - |

### E2Eテストファイル
`test/e2e/foundation-and-scheduler.e2e.test.ts`

### E2Eテスト件数
49件（最終タスクで実行）
