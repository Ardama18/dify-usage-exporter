import type { ExternalApiRecord } from '../types/external-api.js'

/**
 * 外部API送信インターフェース
 *
 * 変換済みデータを外部APIへ送信し、失敗時は自動リトライ・スプール保存を行う。
 */
export interface ISender {
  /**
   * 変換済みデータを外部APIへ送信
   *
   * @param records - 送信するレコード配列
   * @throws {Error} - 送信失敗時（リトライ上限到達、スプール保存失敗）
   *
   * @remarks
   * - リトライ処理（指数バックオフ、最大3回）
   * - 冪等性保証（409 Conflict対応）
   * - リトライ上限到達時はスプール保存
   */
  send(records: ExternalApiRecord[]): Promise<void>

  /**
   * スプールファイルを再送
   *
   * data/spool/ディレクトリ内のファイルをfirstAttempt昇順で読み込み、
   * 外部APIへ再送を試行する。
   *
   * @throws {Error} - 再送失敗時
   *
   * @remarks
   * - 再送成功時はスプールファイルを削除
   * - 再送失敗時はretryCountをインクリメント、lastErrorを更新
   * - retryCount ≥ 10の場合はdata/failed/へ移動し、エラー通知を送信
   */
  resendSpooled(): Promise<void>
}
