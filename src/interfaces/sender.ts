import type { ApiMeterRequest } from '../types/api-meter-schema.js'
import type { SendResult } from '../sender/external-api-sender.js'

/**
 * 外部API送信インターフェース
 *
 * 変換済みデータを外部APIへ送信し、失敗時は自動リトライ・スプール保存を行う。
 */
export interface ISender {
  /**
   * 変換済みデータを外部APIへ送信（ApiMeterRequest形式）
   *
   * @param request - API_Meterリクエスト
   * @returns 送信結果（inserted/updated/totalを含む）
   * @throws {Error} - 送信失敗時
   *
   * @remarks
   * - POST /v1/usage へ送信
   * - リトライ処理（指数バックオフ、最大3回）
   * - 200 OKレスポンスでinserted/updatedを確認
   */
  send(request: ApiMeterRequest): Promise<SendResult>

  // Note: resendSpooled() will be updated in Task 3-3 (spool integration)
}
