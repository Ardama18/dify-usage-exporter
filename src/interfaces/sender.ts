import type { ApiMeterRequest } from '../types/api-meter-schema.js'

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
   * @throws {Error} - 送信失敗時
   *
   * @remarks
   * - POST /v1/usage へ送信
   * - リトライ処理（指数バックオフ、最大3回）
   * - 200 OKレスポンスでinserted/updatedを確認
   */
  send(request: ApiMeterRequest): Promise<void>

  // Note: resendSpooled() will be updated in Task 3-3 (spool integration)
}
