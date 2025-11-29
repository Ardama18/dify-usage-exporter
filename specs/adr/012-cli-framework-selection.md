---
id: "6"
feature: manual-resend-watermark
type: adr
version: 1.0.0
created: 2025-01-22
based_on: (要件サマリーから作成)
---

# ADR 012: CLIフレームワークの選定

## ステータス

Accepted

## コンテキスト

Story 6「手動再送とウォーターマーク操作」において、以下のCLI機能を実装する必要がある：

1. **手動再送コマンド**: `data/failed/`内のファイル一覧表示、指定/全ファイルの再送
2. **ウォーターマーク操作コマンド**: 現在値表示、任意日時へのリセット
3. **失敗ファイル一覧コマンド**: `data/failed/`内のファイル一覧とステータス表示

### 技術的要件

- npm scripts経由での実行（`npm run cli -- コマンド`）
- サブコマンド対応（resend、watermark、list等）
- 引数・オプションのパース
- ヘルプ生成
- 確認プロンプト表示（ウォーターマークリセット時）
- 既存モジュール（SpoolManager、WatermarkManager、ExternalApiSender）との統合

### 評価観点

- **軽量性**: 本プロジェクトは小規模CLIツールであり、過度な依存は不要
- **機能性**: サブコマンド、ヘルプ生成、確認プロンプト
- **TypeScript対応**: 型安全性の確保
- **学習コスト**: 実装の容易さ
- **依存関係**: パッケージサイズと依存数

## 決定事項

**Commander.js v14**を採用する。

### バージョン選定理由

- **v14の採用**: Node.js v20+を要求（プロジェクトは@types/node v24を使用しており、最新環境を想定）
- **v12からv14への変更**: v14は2024年末にリリースされた最新安定版で、内部リファクタリングによるHelp APIの改善を含む

### Node.js要件

| Commander.js | Node.js要件 |
|--------------|-------------|
| v14 | v20+ |
| v12 | v18+ |
| v9 | v12.20.0+ |

```bash
npm install commander@^14.0.0
```

## 根拠

### 検討した選択肢

#### 1. Node.js標準（process.argv手動パース）

- **概要**: 外部依存なしでprocess.argvを直接パース
- **利点**:
  - 依存関係ゼロ
  - 完全なカスタマイズ性
  - バンドルサイズ増加なし
- **欠点**:
  - サブコマンド実装が複雑
  - ヘルプ生成を手動実装
  - エラーメッセージの標準化が困難
  - 開発工数が大幅に増加（推定+2日）

#### 2. Yargs

- **概要**: 強力な引数パース機能を持つCLIフレームワーク
- **利点**:
  - 高度な引数検証機能
  - 多言語対応
  - ネストしたコマンド対応
- **欠点**:
  - パッケージサイズが大きい（約290KB）
  - TypeScript対応にプラグインが必要
  - コールバックスタイルが可読性を低下
  - 本プロジェクトの規模には過剰

#### 3. Oclif

- **概要**: Heroku開発のエンタープライズ向けCLIフレームワーク
- **利点**:
  - TypeScriptファーストクラス対応
  - プラグインシステム
  - 自動生成テンプレート
  - 大規模CLI向けの堅牢なアーキテクチャ
- **欠点**:
  - 学習コストが非常に高い
  - パッケージサイズが巨大
  - 小規模CLIには明らかに過剰（overkill）
  - 設定ファイルやディレクトリ構造の強制
  - 本プロジェクトの3コマンドには不適切

#### 4. Commander.js（採用）

- **概要**: 軽量で柔軟な汎用CLIフレームワーク
- **利点**:
  - **軽量**: 約40KB、依存関係ゼロ
  - **シンプルなAPI**: メソッドチェーンで直感的
  - **TypeScript対応**: 組み込み型定義
  - **豊富な実績**: npm週間2億以上ダウンロード、GitHubスター27,000以上
  - **必要十分な機能**: サブコマンド、ヘルプ生成、オプションパース
  - **学習コストが低い**: 数時間で習得可能
  - **確認プロンプト**: 別ライブラリ（readline等）と組み合わせ容易
- **欠点**:
  - 組み込みの対話機能がない（プロンプトは別途実装）
  - Oclifほどの拡張性はない

### 比較マトリクス

| 評価軸 | process.argv | Yargs | Oclif | Commander.js |
|--------|-------------|-------|-------|--------------|
| パッケージサイズ | 0KB | 290KB | 大 | 40KB |
| 学習コスト | 高 | 中 | 非常に高 | 低 |
| サブコマンド対応 | 手動実装 | あり | あり | あり |
| ヘルプ生成 | 手動実装 | あり | あり | あり |
| TypeScript対応 | - | プラグイン | ファーストクラス | 組み込み |
| 実装工数 | +2日 | +0.5日 | +1日 | 基準 |
| プロジェクト適合性 | 低 | 中 | 低（過剰） | 高 |

### 選定理由

1. **適切な規模感**: 3コマンド程度の小規模CLIに最適
2. **軽量性**: 依存関係ゼロで約40KB、既存のパッケージサイズを最小限に抑制
3. **学習コストの低さ**: シンプルなAPIで実装時間を短縮
4. **TypeScript組み込み対応**: 追加設定不要で型安全
5. **豊富な実績**: Node.jsエコシステムで最も採用されているCLIフレームワーク

## 影響

### ポジティブな影響

- **開発効率**: シンプルなAPIにより実装時間を短縮（推定1日以内）
- **保守性**: 広く使われており、ドキュメントと事例が豊富
- **依存関係の最小化**: 依存ゼロの軽量パッケージ
- **テスタビリティ**: 各コマンドを関数として分離しやすい

### ネガティブな影響

- **対話機能の制限**: 確認プロンプトはNode.js標準（readline）で実装が必要
- **プラグインなし**: 将来的に大規模化する場合は再検討が必要（ただし現時点では不要）

### 中立的な影響

- **既存アーキテクチャへの影響なし**: 新規CLI層（src/cli/）の追加のみ

## 実装への指針

### CLI層の設計

- src/cli/配下にコマンドごとにファイルを分離
- 各コマンドは依存性注入を受け取る関数として実装
- main関数でCommanderプログラムを構築し、コマンドを登録

### エントリーポイント

```typescript
// src/cli/index.ts - エントリーポイント
import { Command } from 'commander'

const program = new Command()
program
  .name('dify-usage-exporter')
  .description('Dify usage data exporter CLI')
  .version('1.0.0')

// サブコマンド登録
program.addCommand(resendCommand)
program.addCommand(watermarkCommand)
program.addCommand(listCommand)

program.parse()
```

### npm scripts設定

```json
{
  "scripts": {
    "cli": "node dist/cli/index.js"
  }
}
```

実行例: `npm run cli -- resend --all`

### 確認プロンプト

Node.js標準のreadline/promisesを使用：

```typescript
import { createInterface } from 'node:readline/promises'

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${message} (y/N): `)
  rl.close()
  return answer.toLowerCase() === 'y'
}
```

### テスト方針

- 各コマンドロジックを純粋関数として実装し、ユニットテストを作成
- process.exit()はモック化してテスト
- 依存モジュール（SpoolManager等）はモック注入

## 参考資料

- [Commander.js GitHub](https://github.com/tj/commander.js): 公式リポジトリ（v12.1.0）
- [Commander.js vs Yargs vs Oclif - npm trends](https://npmtrends.com/commander-vs-oclif-vs-yargs): ダウンロード数比較
- [npm-compare: commander vs yargs vs oclif](https://npm-compare.com/commander,oclif,vorpal,yargs): 機能比較
- [Building CLI Applications Made Easy - Medium](https://ibrahim-haouari.medium.com/building-cli-applications-made-easy-with-these-nodejs-frameworks-2c06d1ff7a51): フレームワーク比較記事

## 関連情報

- [ADR 008: バックエンド基盤技術スタック](specs/adr/008-backend-foundation-tech-stack.md): 基盤技術選定
- Story 6: 手動再送とウォーターマーク機能
