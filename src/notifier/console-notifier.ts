import type { ErrorNotificationMessage, INotifier } from '../interfaces/notifier.js'

/**
 * ConsoleNotifier（モック実装）
 *
 * エラー通知をconsole.errorに出力するだけのモック実装。
 * Story 5でSlackNotifier、EmailNotifierに置き換える。
 */
export class ConsoleNotifier implements INotifier {
  /**
   * エラー通知をconsole.errorに出力
   *
   * @param message - 通知内容
   *
   * @remarks
   * - モック実装のため、実際の通知は送信されない
   * - Story 5で実装されるSlackNotifier、EmailNotifierに置き換える
   */
  async sendErrorNotification(message: ErrorNotificationMessage): Promise<void> {
    console.error('[ERROR NOTIFICATION]', message)
  }
}
