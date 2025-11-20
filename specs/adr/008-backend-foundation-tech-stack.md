---
id: "1"
feature: foundation-and-scheduler
type: adr
version: 1.0.0
created: 2025-01-20
based_on: specs/stories/1-foundation-and-scheduler/requirements.md
---

# ADR 008: バックエンド基盤技術スタック

## ステータス

Accepted (2025-01-20)

## コンテキスト

Dify使用量エクスポートシステムの基盤として、TypeScript/Node.js実行環境、環境変数管理、ログ出力、定期実行スケジューラを構築する必要がある。本システムは後続ストーリー（データ取得、変換、送信、監視）の土台となるため、適切な技術スタックの選択が重要である。

### 技術選定における主要な判断ポイント

1. **ログライブラリ**: 構造化ログ出力、JSON形式対応、運用での可視性
2. **スケジューラ**: cron式対応、Graceful Shutdown対応、TypeScript対応
3. **環境変数バリデーション**: 型安全性、起動時検証、明確なエラーメッセージ
4. **コンテナ対応**: マルチステージビルド、セキュリティ（非rootユーザー）

## 決定事項

以下の技術スタックを採用する：

| カテゴリ | 選定技術 | バージョン |
|---------|---------|-----------|
| ランタイム | Node.js | 20.x LTS |
| 言語 | TypeScript | 5.x (strict mode) |
| ログ | winston | 3.x |
| スケジューラ | cron | 3.x |
| バリデーション | zod | 3.x |
| 環境変数読み込み | dotenv | 16.x |

## 根拠

### 検討した選択肢

#### ログライブラリ

1. **Pino**
   - 利点: 最高のパフォーマンス（winstonの約10倍高速）、低メモリ使用量
   - 欠点: フォーマットの柔軟性が低い、エコシステムがやや小さい

2. **Bunyan**
   - 利点: JSON形式に特化、安定したAPI
   - 欠点: 開発が停滞気味、カスタマイズ性が低い

3. **winston（採用）**
   - 利点:
     - 豊富なTransport（Console、File、外部サービス連携）
     - 柔軟なフォーマット設定（JSON、colorize、timestamp等）
     - 大規模なエコシステムと豊富なドキュメント
     - 2024-2025年の業界標準として広く採用
   - 欠点:
     - Pinoより低速（ただし本システムでは十分な性能）
     - 設定が複雑になりがち

**選定理由**: 本システムではログ出力によるパフォーマンス低下を5%以内に抑える要件があり、winstonでも十分対応可能。構造化ログ、JSON形式出力、ログレベル制御、メタデータ付与など要件を全て満たし、運用面での可視性が最も高い。

#### スケジューラ

1. **Bree**
   - 利点: Worker Threads対応、Graceful Shutdown組み込み、TypeScript対応
   - 欠点: 学習コストが高い、シンプルなユースケースにはオーバースペック

2. **node-schedule**
   - 利点: Date対象もサポート、gracefulShutdown()メソッド内蔵
   - 欠点: node-cronより機能が限定的、メンテナンス頻度が低い

3. **cron（採用）**
   - 利点:
     - シンプルで軽量なAPI（CronJob.from()で宣言的に作成）
     - 標準的なcron式をサポート
     - TypeScript完全対応（@types/cron不要）
     - job.stop()でジョブ停止可能
     - nextDate()で次回実行時刻を取得可能
     - Luxonベースの高精度な時刻処理
     - 広く使われており実績豊富（kelektiv/node-cronリポジトリ）
   - 欠点:
     - Graceful Shutdownは手動実装が必要
     - Worker Threadsはサポートしない

4. **node-cron（非採用）**
   - 利点: シンプルなAPI、cron式検証機能
   - 欠点: cronパッケージより機能が限定的、TypeScript型定義が別パッケージ

**選定理由**: 本システムは単一プロセスでの定期実行であり、Worker Threadsは不要。Graceful Shutdownはシグナルハンドリングで実装可能なため、シンプルで実績があり、TypeScript完全対応のcronパッケージを採用。

#### 環境変数バリデーション

1. **envalid**
   - 利点: 環境変数専用設計、cleanEnv関数で簡潔
   - 欠点: Zodほど表現力がない、プロジェクト全体での一貫性確保が難しい

2. **joi**
   - 利点: 豊富なバリデーション機能、企業採用実績多数
   - 欠点: TypeScript型推論がZodより弱い、APIが冗長

3. **zod（採用）**
   - 利点:
     - TypeScriptとの完全な統合（型推論が優秀）
     - safeParse()による安全なバリデーション
     - z.infer<>による型生成
     - 文字列から数値への変換（z.coerce）
     - 明確なエラーメッセージ
     - 2024年のベストプラクティスとして広く推奨
   - 欠点:
     - 学習コストがやや高い（ただし一度覚えれば効率的）

**選定理由**: TypeScriptプロジェクトにおいて、型推論とバリデーションを統合できるZodは最適解。後続ストーリーでAPIレスポンスの検証にも使用するため、プロジェクト全体で一貫したバリデーション手法を採用できる。

## 影響

### ポジティブな影響

- **開発効率の向上**: TypeScript strict modeと型推論により、コンパイル時にエラーを検出
- **運用可視性の確保**: JSON形式の構造化ログにより、ログ解析ツールでの検索・フィルタリングが容易
- **設定ミスの早期発見**: Zodによる起動時バリデーションで、環境変数の設定ミスを即座に検出
- **保守性の向上**: 広く採用されている技術スタックにより、ドキュメントやコミュニティサポートが豊富
- **後続ストーリーへの一貫性**: 同じ技術スタックを後続ストーリーでも活用可能

### ネガティブな影響

- **Graceful Shutdown実装コスト**: node-cronは組み込みのGraceful Shutdownを持たないため、手動実装が必要
- **winstonの設定複雑性**: 柔軟性の代償として、初期設定がやや複雑
- **依存ライブラリの増加**: 4つの外部依存（winston, node-cron, zod, dotenv）が追加される

### 中立的な影響

- **Node.js 20.x LTSの採用**: 2024年10月時点での最新LTSであり、2026年4月までサポート対象

## 実装への指針

### ログ出力

- JSON Lines形式で標準出力（stdout）に出力
- ログレベルはerror > warn > info > debugの優先順位
- defaultMetaでサービス名、バージョンを全ログに付与
- エラーログにはスタックトレースを含める
- シークレット情報（トークン、APIキー）は絶対にログ出力しない

### 環境変数管理

- 全ての設定はsrc/config/env-config.tsで一元管理
- Zodスキーマで必須/オプション/デフォルト値を定義
- safeParse()を使用し、失敗時は明確なエラーメッセージを出力してexit 1
- process.envの直接参照は禁止、設定管理層経由でアクセス

### スケジューラ

- cronパッケージのCronJob.from()でジョブを作成
- ジョブ参照を保持し、Graceful Shutdown時にstop()を呼び出し
- try-catchでタスクエラーを捕捉し、ログ出力
- cron式の検証は別途バリデーション関数を実装（cronパッケージには組み込みの検証がないため）

### Graceful Shutdown

- SIGINT、SIGTERMをprocess.on()でハンドリング
- タイムアウト付きの強制終了機能を実装
- 実行中タスクの完了を待機

### コンテナ対応

- マルチステージビルドでイメージサイズを最小化
- 非rootユーザー（node:20-alpine）で実行
- HEALTHCHECKは後続ストーリーで実装

## 参考資料

- [Winston Logger - BetterStack Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-winston-and-morgan-to-log-node-js-applications/): 2024-2025年のベストプラクティス
- [Winston Production Logging - Last9](https://last9.io/blog/winston-logging-in-nodejs/): 構造化ログのパターン
- [cron GitHub](https://github.com/kelektiv/node-cron): cronパッケージ（TypeScript完全対応、Luxonベース）
- [Graceful Shutdown Best Practices](https://infinitejs.com/posts/mastering-graceful-shutdowns-nodejs/): Node.jsでの実装パターン
- [Zod Environment Validation](https://creatures.sh/blog/env-type-safety-and-validation/): 型安全な環境変数検証
- [Validate ENV Variables with Zod](https://catalins.tech/validate-environment-variables-with-zod/): safeParse()のベストプラクティス

## 関連情報

- [specs/stories/1-foundation-and-scheduler/requirements.md](specs/stories/1-foundation-and-scheduler/requirements.md): 要件定義書
- [specs/epics/1-dify-usage-exporter/epic.md](specs/epics/1-dify-usage-exporter/epic.md): エピック方針書
