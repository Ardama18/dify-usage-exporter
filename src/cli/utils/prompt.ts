/**
 * 確認プロンプトユーティリティ
 * Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * ADR: ADR 012 - CLIフレームワークの選定
 * ACトレーサビリティ: AC-WM-3, AC-WM-4, AC-WM-5
 */

import * as readline from 'node:readline/promises'

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
