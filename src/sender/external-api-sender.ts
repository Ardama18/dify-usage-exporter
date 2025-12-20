/**
 * 外部API送信クラス
 *
 * 変換済みデータを外部APIへ送信し、失敗時は自動リトライ・スプール保存を行う。
 * リトライ上限到達時はスプールファイルへ保存し、次回実行時に再送を試行する。
 */

import { AxiosError, type AxiosResponse } from 'axios'
import type { INotifier } from '../interfaces/notifier.js'
import type { ISender } from '../interfaces/sender.js'
import type { Logger } from '../logger/winston-logger.js'
import type { ApiMeterRequest } from '../types/api-meter-schema.js'
import type { EnvConfig } from '../types/env.js'
import type { ExecutionMetrics } from '../types/metrics.js'
import type { HttpClient } from './http-client.js'
import type { SpoolManager } from './spool-manager.js'

/**
 * API_Meterレスポンス形式
 * 200 OKレスポンスで返される情報
 */
interface ApiMeterResponse {
  inserted: number
  updated: number
  total: number
}

/**
 * 外部API送信クラス
 *
 * HttpClientとSpoolManagerを統合し、送信・リトライ・スプール保存を管理する。
 */
export class ExternalApiSender implements ISender {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly _spoolManager: SpoolManager,
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Task 3-3で使用予定
    private readonly _notifier: INotifier,
    private readonly logger: Logger,
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Task 3-3で使用予定
    private readonly _config: EnvConfig,
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: _metrics is used in handleSuccessResponse/handleSendErrorWithSpool
    private readonly _metrics: ExecutionMetrics,
  ) {}

  /**
   * 変換済みデータを外部APIへ送信（ApiMeterRequest形式）
   *
   * @param request - API_Meterリクエスト
   * @throws {Error} - 送信失敗時
   */
  async send(request: ApiMeterRequest): Promise<void> {
    try {
      // 1. 外部APIへ送信（POST /v1/usage）
      const response = await this.httpClient.post('/v1/usage', request)

      // 2. 200 OKレスポンス: 成功（inserted/updated確認）
      this.handleSuccessResponse(response, request)
    } catch (error) {
      // 3. エラー処理: リトライ上限到達時はスプール保存
      await this.handleSendErrorWithSpool(error, request)
      throw error
    }
  }

  /**
   * 成功レスポンスのハンドリング
   * 200 OKレスポンスでinserted/updatedを確認
   *
   * @param response - axiosレスポンス
   * @param request - API_Meterリクエスト
   */
  private handleSuccessResponse(response: AxiosResponse, request: ApiMeterRequest): void {
    const recordCount = request.records.length
    this._metrics.sendSuccess += recordCount

    // inserted/updatedが含まれる場合は詳細ログ
    const data = response.data as Partial<ApiMeterResponse>
    if (data.inserted !== undefined && data.updated !== undefined && data.total !== undefined) {
      this.logger.info(
        `Successfully sent ${recordCount} records: inserted=${data.inserted}, updated=${data.updated}, total=${data.total}`,
        {
          recordCount,
          inserted: data.inserted,
          updated: data.updated,
          total: data.total,
        },
      )
    } else {
      this.logger.info(`Successfully sent ${recordCount} records`, { recordCount })
    }
  }

  /**
   * 送信エラーのハンドリング（スプール保存付き）
   * リトライ上限到達時はスプールファイルへ保存
   *
   * @param error - エラーオブジェクト
   * @param request - API_Meterリクエスト
   */
  private async handleSendErrorWithSpool(error: unknown, request: ApiMeterRequest): Promise<void> {
    const recordCount = request.records.length
    this._metrics.sendFailed += 1

    if (!(error instanceof AxiosError)) {
      this.logger.error(`Failed to send ${recordCount} records: ${String(error)}`, {
        recordCount,
        error: error instanceof Error ? error.message : String(error),
      })

      // リトライ上限到達時はスプール保存
      await this.saveToSpoolOnError(request)
      return
    }

    const status = error.response?.status
    const errorMessage = error.message
    const retryCount = error.config?.['axios-retry']?.retryCount

    this.logger.error(`Failed to send ${recordCount} records: ${errorMessage}`, {
      recordCount,
      status,
      message: errorMessage,
      retryCount,
    })

    // リトライ上限到達時はスプール保存
    await this.saveToSpoolOnError(request)
  }

  /**
   * リトライ上限到達時のスプール保存
   * エラー時にスプールファイルへ保存し、次回実行時に再送を試行
   *
   * @param request - API_Meterリクエスト
   */
  private async saveToSpoolOnError(request: ApiMeterRequest): Promise<void> {
    try {
      const filename = await this._spoolManager.save(request)
      this.logger.info('Saved to spool file for retry', {
        filename,
        recordCount: request.records.length,
      })
    } catch (spoolError) {
      this.logger.error('Failed to save to spool file', {
        error: spoolError instanceof Error ? spoolError.message : String(spoolError),
        recordCount: request.records.length,
      })
    }
  }

  // Note: resendFailedFile(), resendSpooled(), calculateBatchKey(), etc.
  // will be updated in Task 3-3 (spool integration)
}
