/**
 * エラー通知メッセージ
 *
 * data/failed/移動時に送信する通知の内容を定義する。
 */
export interface ErrorNotificationMessage {
  /** 通知タイトル（エラー概要） */
  title: string
  /** 失敗したファイルのパス */
  filePath: string
  /** 最後に発生したエラーメッセージ */
  lastError: string
  /** 最初の送信試行日時（ISO 8601形式） */
  firstAttempt: string
  /** リトライ回数 */
  retryCount: number
}

/**
 * エラー通知インターフェース
 *
 * data/failed/移動時にエラー通知を送信する。
 * 具体的な通知手段（Slack、メール等）は実装クラスで定義する。
 */
export interface INotifier {
  /**
   * エラー通知を送信
   *
   * @param message - 通知内容
   * @throws {Error} - 通知送信失敗時
   *
   * @remarks
   * - 通知失敗時もエラーを握りつぶさず、上位層でログ記録
   * - 通知失敗で処理全体を停止しない（ベストエフォート）
   */
  sendErrorNotification(message: ErrorNotificationMessage): Promise<void>
}
