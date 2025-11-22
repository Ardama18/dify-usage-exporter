/**
 * 外部API送信クラス
 *
 * 変換済みデータを外部APIへ送信し、失敗時は自動リトライ・スプール保存を行う。
 * リトライ上限到達時はスプールファイルへ保存し、次回実行時に再送を試行する。
 */

import { createHash } from 'node:crypto'
import { AxiosError } from 'axios'
import type { INotifier } from '../interfaces/notifier.js'
import type { ISender } from '../interfaces/sender.js'
import type { Logger } from '../logger/winston-logger.js'
import type { EnvConfig } from '../types/env.js'
import type { ExternalApiRecord } from '../types/external-api.js'
import type { ExecutionMetrics } from '../types/metrics.js'
import type { SpoolFile } from '../types/spool.js'
import type { HttpClient } from './http-client.js'
import type { SpoolManager } from './spool-manager.js'

/**
 * 外部API送信クラス
 *
 * HttpClientとSpoolManagerを統合し、送信・リトライ・スプール保存を管理する。
 */
export class ExternalApiSender implements ISender {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly spoolManager: SpoolManager,
    private readonly notifier: INotifier,
    private readonly logger: Logger,
    private readonly config: EnvConfig,
    private readonly metrics: ExecutionMetrics,
  ) {}

  /**
   * 変換済みデータを外部APIへ送信
   *
   * @param records - 送信するレコード配列
   * @throws {Error} - 送信失敗時（リトライ上限到達以外）
   */
  async send(records: ExternalApiRecord[]): Promise<void> {
    const batchKey = this.calculateBatchKey(records)

    try {
      // 1. 外部APIへ送信
      await this.sendToExternalApi(records)
    } catch (error) {
      // 2. リトライ上限到達: スプール保存
      if (this.isMaxRetriesError(error)) {
        await this.handleMaxRetriesError(records, batchKey, error)
        return
      }

      // 3. その他のエラー: 再スロー
      throw error
    }
  }

  /**
   * 外部APIへ送信（内部メソッド）
   *
   * @param records - 送信するレコード配列
   * @throws {Error} - 送信失敗時
   */
  private async sendToExternalApi(records: ExternalApiRecord[]): Promise<void> {
    const batchKey = this.calculateBatchKey(records)

    try {
      // 1. 外部APIへ送信
      const response = await this.httpClient.post('/usage', {
        batchIdempotencyKey: batchKey,
        records,
      })

      // 2. 200/201レスポンス: 成功
      if (response.status === 200 || response.status === 201) {
        this.metrics.sendSuccess += records.length
        this.logger.info('Send success', { recordCount: records.length })
        return
      }

      // 3. 409レスポンス: 重複検出、成功扱い
      if (response.status === 409) {
        this.metrics.sendSuccess += records.length
        this.logger.warn('Duplicate data detected', { batchKey })
        return
      }
    } catch (error) {
      // 4. 409エラー: 重複検出、成功扱い
      if (error instanceof AxiosError && error.response?.status === 409) {
        this.metrics.sendSuccess += records.length
        this.logger.warn('Duplicate data detected', { batchKey })
        return
      }

      // 5. その他のエラー: 再スロー
      throw error
    }
  }

  /**
   * CLI手動再送用メソッド
   *
   * data/failed/内のファイルを外部APIへ送信する。
   * 自動リトライ後のスプール保存ロジックを含まない純粋な送信処理。
   *
   * @param records - 送信するレコード配列
   * @throws {Error} - 送信失敗時（リトライは行わない、またはaxios-retryのみ）
   */
  async resendFailedFile(records: ExternalApiRecord[]): Promise<void> {
    const batchKey = this.calculateBatchKey(records)

    try {
      const response = await this.httpClient.post('/usage', {
        batchIdempotencyKey: batchKey,
        records,
      })

      if (response.status === 200 || response.status === 201) {
        this.logger.info('CLI resend success', { recordCount: records.length })
        return
      }

      if (response.status === 409) {
        this.logger.warn('CLI resend: duplicate detected', { batchKey })
        return
      }
    } catch (error) {
      // 409エラー: 重複検出、成功扱い
      if (error instanceof AxiosError && error.response?.status === 409) {
        this.logger.warn('CLI resend: duplicate detected', { batchKey })
        return
      }

      // その他のエラー: 再スロー
      throw error
    }
  }

  /**
   * スプールファイルを再送
   *
   * data/spool/ディレクトリ内のファイルをfirstAttempt昇順で読み込み、
   * 外部APIへ再送を試行する。
   *
   * @throws {Error} - 再送失敗時
   */
  async resendSpooled(): Promise<void> {
    const spoolFiles = await this.spoolManager.listSpoolFiles()

    for (const spoolFile of spoolFiles) {
      try {
        // 1. 再送試行（外部APIへ直接送信）
        await this.sendToExternalApi(spoolFile.records)

        // 2. 成功: スプールファイル削除
        await this.spoolManager.deleteSpoolFile(spoolFile.batchIdempotencyKey)
        this.metrics.spoolResendSuccess += 1
        this.logger.info('Spool resend success', { batchKey: spoolFile.batchIdempotencyKey })
      } catch (error) {
        // 3. 失敗: retryCountインクリメント
        await this.handleResendError(spoolFile, error)
      }
    }
  }

  /**
   * リトライ上限到達エラーの処理
   *
   * @param records - 送信レコード
   * @param batchKey - バッチ冪等キー
   * @param error - エラーオブジェクト
   */
  private async handleMaxRetriesError(
    records: ExternalApiRecord[],
    batchKey: string,
    error: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await this.spoolManager.saveToSpool({
      batchIdempotencyKey: batchKey,
      records,
      firstAttempt: new Date().toISOString(),
      retryCount: 0,
      lastError: errorMessage,
    })

    this.metrics.sendFailed += records.length
    this.metrics.spoolSaved += 1
    this.logger.warn('Spooled due to max retries', { recordCount: records.length })
  }

  /**
   * 再送エラーの処理
   *
   * @param spoolFile - スプールファイル
   * @param error - エラーオブジェクト
   */
  private async handleResendError(spoolFile: SpoolFile, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // retryCountインクリメント
    const updatedSpoolFile: SpoolFile = {
      ...spoolFile,
      retryCount: spoolFile.retryCount + 1,
      lastError: errorMessage,
    }

    // リトライ上限チェック
    if (updatedSpoolFile.retryCount >= this.config.MAX_SPOOL_RETRIES) {
      // data/failed/へ移動
      await this.spoolManager.moveToFailed(updatedSpoolFile)
      this.metrics.failedMoved += 1
      this.logger.error('Moved to failed', { batchKey: updatedSpoolFile.batchIdempotencyKey })

      // エラー通知送信
      try {
        await this.notifier.sendErrorNotification({
          title: 'Spool retry limit exceeded',
          filePath: `data/failed/failed_${new Date().toISOString().replace(/[:.]/g, '')}_${updatedSpoolFile.batchIdempotencyKey}.json`,
          lastError: updatedSpoolFile.lastError,
          firstAttempt: updatedSpoolFile.firstAttempt,
          retryCount: updatedSpoolFile.retryCount,
        })
      } catch (notificationError) {
        // 通知失敗時もエラーを握りつぶさず、ログに記録
        this.logger.error('Failed to send error notification', {
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
          batchKey: updatedSpoolFile.batchIdempotencyKey,
        })
      }
    } else {
      // retryCount更新
      await this.spoolManager.updateSpoolFile(updatedSpoolFile)
      this.logger.warn('Spool resend failed', {
        batchKey: updatedSpoolFile.batchIdempotencyKey,
        retryCount: updatedSpoolFile.retryCount,
      })
    }
  }

  /**
   * バッチ冪等キー生成
   *
   * レコード配列の冪等キーをソートして連結し、SHA256ハッシュを生成する。
   *
   * @param records - レコード配列
   * @returns SHA256ハッシュ（16進数文字列）
   */
  private calculateBatchKey(records: ExternalApiRecord[]): string {
    const keys = records.map((r) => r.idempotency_key).sort()
    const keysString = keys.join('|')
    return createHash('sha256').update(keysString).digest('hex')
  }

  /**
   * リトライ上限到達エラーの判定
   *
   * axios-retryのリトライ上限到達エラーを判定する。
   *
   * @param error - エラーオブジェクト
   * @returns リトライ上限到達の場合true
   */
  private isMaxRetriesError(error: unknown): boolean {
    if (!(error instanceof AxiosError)) {
      return false
    }

    const retryCount = error.config?.['axios-retry']?.retryCount
    return typeof retryCount === 'number' && retryCount >= this.config.MAX_RETRIES
  }
}
