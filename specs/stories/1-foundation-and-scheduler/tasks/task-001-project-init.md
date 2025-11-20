---
story_id: "1"
title: foundation-and-scheduler
feature: foundation
task_number: "001"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: プロジェクト初期化

メタ情報:
- 依存: なし（初期タスク）
- 提供: package.json, tsconfig.json, npm scripts（後続タスクの基盤）
- サイズ: 小規模（設定ファイルのみ）

## 実装内容

TypeScript/Node.js実行環境の初期構築を行う。npm init、依存ライブラリのインストール、TypeScript設定、npm scriptsの定義を実施。

## 対象ファイル

- [x] package.json
- [x] tsconfig.json
- [x] .gitignore
- [x] .env.example
- [x] biome.json（lint設定）

## 実装手順

### 1. プロジェクト初期化

- [x] `npm init -y` で package.json 作成
- [x] package.json の修正
  - name: "dify-usage-exporter"
  - version: "1.0.0"
  - type: "module"
  - main: "dist/index.js"

### 2. 依存ライブラリのインストール

- [x] 本番依存のインストール
  ```bash
  npm install winston dotenv zod cron
  ```
- [x] 開発依存のインストール
  ```bash
  npm install -D typescript @types/node vitest @biomejs/biome
  ```

### 3. TypeScript設定

- [x] tsconfig.json 作成
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "lib": ["ES2022"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "test"]
  }
  ```

### 4. npm scripts設定

- [x] package.json に scripts を追加
  ```json
  {
    "scripts": {
      "build": "tsc",
      "start": "node dist/index.js",
      "dev": "tsc --watch",
      "test": "vitest run",
      "test:watch": "vitest",
      "test:coverage": "vitest run --coverage",
      "test:integration": "vitest run test/integration",
      "test:e2e": "vitest run test/e2e",
      "check": "biome check .",
      "format": "biome format --write .",
      "lint:fix": "biome lint --write .",
      "check:all": "npm run check && npm run build && npm run test"
    }
  }
  ```

### 5. 設定ファイル作成

- [x] .gitignore 作成
  ```
  node_modules/
  dist/
  .env
  coverage/
  *.log
  .DS_Store
  ```

- [x] .env.example 作成
  ```bash
  # 必須環境変数
  DIFY_API_URL=https://api.dify.ai
  DIFY_API_TOKEN=your-dify-api-token
  EXTERNAL_API_URL=https://external-api.example.com
  EXTERNAL_API_TOKEN=your-external-api-token

  # オプション環境変数
  CRON_SCHEDULE=0 0 * * *
  LOG_LEVEL=info
  GRACEFUL_SHUTDOWN_TIMEOUT=30
  MAX_RETRY=3
  NODE_ENV=production
  ```

- [x] biome.json 作成（基本設定）

### 6. ビルド確認

- [x] 空のエントリーポイント作成（ビルド確認用）
  ```typescript
  // src/index.ts
  console.log('dify-usage-exporter initialized')
  ```
- [x] `npm run build` でビルド成功確認
- [x] `node dist/index.js` で実行確認

## 完了条件

- [x] `npm run build` が成功する
- [x] TypeScript strict mode が有効（tsconfig.jsonで確認）
- [x] `npm run check` でlint/formatエラーなし
- [x] 動作確認完了（L1: ビルドコマンド成功）
  ```bash
  npm run build && node dist/index.js
  ```

## 注意事項

- **影響範囲**: 後続全タスクの基盤となる
- **制約**: Design Docの依存ライブラリバージョンに準拠
  - winston: ^3.11.0
  - dotenv: ^16.3.1
  - zod: ^3.22.4
  - cron: ^3.1.6
- ESM (ECMAScript Modules) を使用（type: "module"）
