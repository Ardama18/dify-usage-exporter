---
story_id: "6"
title: manual-resend-watermark
feature: cli
task_number: "009"
phase: 3
version: 1.0.0
created: 2025-11-22
based_on: specs/stories/6-manual-resend-watermark/plan.md
---

# タスク: promptユーティリティ実装

メタ情報:
- 依存:
  - task-002: CLI基盤 → 成果物: src/cli/
- 提供: src/cli/utils/prompt.ts
- サイズ: 小規模（1ファイル + テスト）

## 実装内容

確認プロンプト用のユーティリティを実装する。
- confirmPrompt()関数: Node.js readline/promisesを使用
- y入力でtrue、それ以外でfalse

## 対象ファイル
- [x] src/cli/utils/prompt.ts（新規）
- [x] src/cli/__tests__/utils/prompt.test.ts（新規）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] Node.js readline/promises APIを確認
- [x] 単体テストを作成（src/cli/__tests__/utils/prompt.test.ts）
  - y入力でtrue
  - Y入力でtrue
  - n入力でfalse
  - 空入力でfalse
  - その他の入力でfalse
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] prompt.tsの実装
  ```typescript
  import * as readline from 'readline/promises'

  /**
   * 確認プロンプトを表示し、ユーザーの応答を返す
   *
   * @param message - 表示するメッセージ
   * @returns y/Y入力でtrue、それ以外でfalse
   */
  export async function confirmPrompt(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    try {
      const answer = await rl.question(`${message} (y/N): `)
      return answer.toLowerCase() === 'y'
    } finally {
      rl.close()
    }
  }
  ```
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] エラーハンドリングの改善
- [x] リソースクリーンアップの確認
- [x] 追加したテストが引き続き通ることを確認

## 完了条件
- [x] 単体テストが全てパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm test -- --run src/cli/__tests__/utils/prompt.test.ts
  ```

## 注意事項
- 影響範囲: src/cli/utils/
- 制約: Node.js readline/promisesを使用
- テスト時のstdin/stdoutモック考慮

## ACトレーサビリティ
- AC-WM-3: reset時に確認プロンプト表示
- AC-WM-4: 確認「y」でウォーターマークリセット
- AC-WM-5: 確認「y」以外でリセットキャンセル
