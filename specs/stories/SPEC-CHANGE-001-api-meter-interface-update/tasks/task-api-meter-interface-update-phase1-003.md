---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 003
phase: 1
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: 環境変数の追加

メタ情報:
- 依存: task-api-meter-interface-update-phase1-001 → 成果物: src/types/api-meter-schema.ts
- 提供: src/types/env.ts（更新）, .env.example（更新）
- サイズ: 小規模（2ファイル）

## 実装内容

API_Meter新仕様に対応した環境変数を追加し、zodスキーマでバリデーションを実装します。

### 追加する環境変数
1. `API_METER_TENANT_ID` - UUID形式のテナントID（必須）
2. `API_METER_TOKEN` - Bearer Token認証用トークン（必須）
3. `API_METER_URL` - API_MeterのエンドポイントURL（必須）

### バリデーションルール
- `API_METER_TENANT_ID`: UUID形式
- `API_METER_TOKEN`: 非空文字列
- `API_METER_URL`: 非空文字列（URL形式）

## 対象ファイル

- [x] src/types/env.ts（更新）
- [x] .env.example（更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認: `src/types/api-meter-schema.ts` が存在することを確認
- [x] `src/types/env.test.ts` を作成（存在しない場合）
- [x] 失敗するテストを作成:
  - API_METER_TENANT_ID が UUID 形式でバリデーション成功
  - API_METER_TENANT_ID が UUID 形式でない場合にエラー
  - API_METER_TOKEN, API_METER_URL が非空文字列でバリデーション成功
  - API_METER_TOKEN, API_METER_URL が空文字列の場合にエラー
- [x] テスト実行して失敗を確認: `npm test src/types/env.test.ts`

### 2. Green Phase

#### 2-1. env.ts の更新
```typescript
// src/types/env.ts
import { z } from 'zod'

export const envSchema = z.object({
  // 既存の環境変数...

  // API_Meter新仕様対応
  API_METER_TENANT_ID: z.string().uuid({
    message: 'API_METER_TENANT_ID must be a valid UUID',
  }),
  API_METER_TOKEN: z.string().min(1, {
    message: 'API_METER_TOKEN must not be empty',
  }),
  API_METER_URL: z.string().url({
    message: 'API_METER_URL must be a valid URL',
  }).min(1, {
    message: 'API_METER_URL must not be empty',
  }),
})

export type Env = z.infer<typeof envSchema>

export const loadEnv = (): Env => {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Environment validation failed:', result.error.format())
    throw new Error('Invalid environment variables')
  }

  return result.data
}
```

#### 2-2. .env.example の更新
```bash
# .env.example

# 既存の環境変数...

# API_Meter設定（新仕様対応）
API_METER_TENANT_ID=00000000-0000-0000-0000-000000000000
API_METER_TOKEN=your_bearer_token_here
API_METER_URL=https://api-meter.example.com
```

- [x] 追加したテストのみ実行して通ることを確認: `npm test src/types/env.test.ts`

### 3. Refactor Phase
- [x] zodスキーマのエラーメッセージ改善
- [x] コメントの追加（必要に応じて）
- [x] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス（テストファイルがある場合）
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: 環境変数読み込み確認）
  ```bash
  # .envファイルに新環境変数を設定
  npm run build
  # エラーなく起動することを確認
  ```
- [x] 成果物作成完了:
  - `src/types/env.ts`（更新）
  - `.env.example`（更新）

## テストケース

### 正常系
- [x] API_METER_TENANT_ID が UUID 形式で成功
- [x] API_METER_TOKEN, API_METER_URL が非空文字列で成功
- [x] API_METER_URL が URL 形式で成功

### 異常系
- [x] API_METER_TENANT_ID が UUID 形式でない場合にエラー
- [x] API_METER_TOKEN が空文字列の場合にエラー
- [x] API_METER_URL が空文字列の場合にエラー
- [x] API_METER_URL が URL 形式でない場合にエラー
- [x] 環境変数が未定義の場合にエラー

## 注意事項

- **影響範囲**:
  - `src/types/env.ts` の更新
  - `.env.example` の更新
  - 既存の環境変数には影響なし
- **制約**:
  - 既存の環境変数を削除・変更しない
  - zodスキーマでの厳密なバリデーション必須
- **セキュリティ考慮**:
  - `.env` ファイルはGit管理対象外（.gitignore確認）
  - サンプル値は実際のトークンを含まない
- **次タスクへの引き継ぎ**:
  - 変換層（Task 2-1）でAPI_METER_TENANT_IDを使用
  - 送信層（Task 3-1）でAPI_METER_TOKEN, API_METER_URLを使用

## ドキュメント更新

### README.md の更新内容
```markdown
## 環境変数

| 変数名 | 説明 | 必須 | 形式 |
|-------|------|-----|------|
| API_METER_TENANT_ID | API_MeterのテナントID | ✓ | UUID |
| API_METER_TOKEN | API_MeterのBearer Token | ✓ | 文字列 |
| API_METER_URL | API_MeterのエンドポイントURL | ✓ | URL |
```

- [ ] README.mdの環境変数セクションを更新

## 参考資料

- [Design Document](../design.md) - 第8章「環境変数の追加」
- [Zod Documentation](https://zod.dev/)
- [API_Meter Authentication Guide](https://api-meter.example.com/docs/auth)
