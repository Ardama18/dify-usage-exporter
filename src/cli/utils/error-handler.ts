/**
 * CLIエラーハンドリングユーティリティ
 *
 * エラーの種類に応じた適切なメッセージ出力とexit codeを提供する。
 */

/**
 * バリデーションエラー
 *
 * 入力値やパラメータの検証に失敗した場合に使用する。
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * エラーをハンドリングしてCLIを終了
 *
 * Design Doc: handleError関数
 * - ValidationErrorの場合: エラーメッセージを表示
 * - 通常のErrorの場合: エラーメッセージを表示、DEBUG環境変数でスタックトレース
 * - その他の場合: 「Unknown error occurred」を表示
 *
 * @param error - 発生したエラー
 * @returns never - process.exit(1)で終了
 */
export function handleError(error: unknown): never {
  if (error instanceof ValidationError) {
    console.error(`Error: ${error.message}`)
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
  } else {
    console.error('Unknown error occurred')
  }
  process.exit(1)
}
