---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 006
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: 正規化処理と単体テスト作成

メタ情報:
- 依存:
  - task-transform-phase1-003 -> 成果物: src/utils/date-utils.ts
  - task-transform-phase2-005 -> 成果物: src/transformer/idempotency-key.ts
- 提供: src/transformer/data-transformer.ts（正規化部分）
- サイズ: 小規模（2ファイル）

## 実装内容

provider/model正規化処理を実装する。小文字変換と空白除去を行う。

### AC対応
- AC1-3（provider正規化）
- AC1-4（model正規化）

## 対象ファイル

- [x] src/transformer/data-transformer.ts（新規作成、正規化部分）
- [x] test/unit/transformer/data-transformer.test.ts（新規作成、正規化部分）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] 依存成果物の確認:
  - src/utils/date-utils.ts
  - src/transformer/idempotency-key.ts
- [x] テストファイル `test/unit/transformer/data-transformer.test.ts` を作成
- [x] 以下のテストケースを記述（正規化部分のみ）:
  - 大文字を小文字に変換
  - 前後の空白を除去
  - 特殊文字（タブ、改行）の処理
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- test/unit/transformer/data-transformer.test.ts
  ```

### 2. Green Phase

- [x] `src/transformer/data-transformer.ts` を作成
- [x] normalizeProvider、normalizeModel関数を実装:
  ```typescript
  export function normalizeProvider(provider: string): string {
    return provider.trim().toLowerCase()
  }

  export function normalizeModel(model: string): string {
    return model.trim().toLowerCase()
  }
  ```
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- test/unit/transformer/data-transformer.test.ts
  ```

### 3. Refactor Phase

- [x] 必要に応じてコード改善
- [x] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeProvider,
  normalizeModel,
} from '../../../src/transformer/data-transformer.js'

describe('normalizeProvider', () => {
  it('should convert uppercase to lowercase', () => {
    expect(normalizeProvider('OpenAI')).toBe('openai')
    expect(normalizeProvider('ANTHROPIC')).toBe('anthropic')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeProvider('  openai  ')).toBe('openai')
    expect(normalizeProvider('\topenai\t')).toBe('openai')
  })

  it('should handle special characters (tab, newline)', () => {
    expect(normalizeProvider('\n openai \n')).toBe('openai')
    expect(normalizeProvider(' OpenAI \t')).toBe('openai')
  })

  it('should handle already normalized input', () => {
    expect(normalizeProvider('openai')).toBe('openai')
  })
})

describe('normalizeModel', () => {
  it('should convert uppercase to lowercase', () => {
    expect(normalizeModel('GPT-4')).toBe('gpt-4')
    expect(normalizeModel('Claude-3-OPUS')).toBe('claude-3-opus')
  })

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeModel('  gpt-4  ')).toBe('gpt-4')
    expect(normalizeModel('\tgpt-4\t')).toBe('gpt-4')
  })

  it('should handle special characters (tab, newline)', () => {
    expect(normalizeModel('\n gpt-4 \n')).toBe('gpt-4')
    expect(normalizeModel(' GPT-4 \t')).toBe('gpt-4')
  })

  it('should handle already normalized input', () => {
    expect(normalizeModel('gpt-4')).toBe('gpt-4')
  })

  it('should preserve hyphens and dots', () => {
    expect(normalizeModel('gpt-4-turbo')).toBe('gpt-4-turbo')
    expect(normalizeModel('claude-3.5-sonnet')).toBe('claude-3.5-sonnet')
  })
})
```

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npx tsc --noEmit
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm run test:unit -- test/unit/transformer/data-transformer.test.ts
  ```

## 注意事項

- 影響範囲: このタスクは新規ファイル追加のため、既存コードへの影響なし
- 制約: trim()とtoLowerCase()のみ使用（複雑な正規化は行わない）
- 正規化後の値は冪等キー生成で使用されるため、決定的な結果を保証すること
