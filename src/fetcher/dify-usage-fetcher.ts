/**
 * DifyUsageFetcher
 *
 * Dify Console APIから使用量データを取得するオーケストレーションコンポーネント。
 * ウォーターマーク読み込み、ページング処理、zodバリデーション、ウォーターマーク更新を連携させる。
 * IFetcherインターフェースを実装。
 */

import type { FetchError, FetchResult, IFetcher } from '../interfaces/fetcher.js'
import type { Logger } from '../logger/winston-logger.js'
import type { DifyUsageRecord } from '../types/dify-usage.js'
import { difyUsageRecordSchema } from '../types/dify-usage.js'
import type { EnvConfig } from '../types/env.js'
import type { Watermark } from '../types/watermark.js'
import type { WatermarkManager } from '../watermark/watermark-manager.js'
import type { DifyApiClient } from './dify-api-client.js'

/**
 * DifyUsageFetcher作成時の依存関係
 */
export interface DifyUsageFetcherDeps {
  client: DifyApiClient
  watermarkManager: WatermarkManager
  logger: Logger
  config: EnvConfig
}

/**
 * DifyUsageFetcherを作成する
 * @param deps 依存関係（DifyApiClient, WatermarkManager, Logger, EnvConfig）
 * @returns IFetcherインスタンス
 */
export function createDifyUsageFetcher(deps: DifyUsageFetcherDeps): IFetcher {
  const { client, watermarkManager, logger, config } = deps

  return {
    async fetch(onRecords): Promise<FetchResult> {
      const startTime = Date.now()
      const errors: FetchError[] = []
      let totalRecords = 0
      let totalPages = 0

      // 1. ウォーターマーク読み込み
      const watermark = await watermarkManager.load()
      const startDate = calculateStartDate(watermark, config)
      const endDate = new Date()

      logger.info('Dify使用量取得開始', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      // 2. ページング処理
      let page = 1
      let hasMore = true

      while (hasMore) {
        try {
          const response = await client.fetchUsage({
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            page,
            limit: config.DIFY_FETCH_PAGE_SIZE,
          })

          // 3. バリデーション
          const validRecords = validateRecords(response.data, errors, logger)

          if (validRecords.length > 0) {
            await onRecords(validRecords)
            totalRecords += validRecords.length
          }

          totalPages = page
          hasMore = response.has_more
          page++

          // 4. 進捗ログ（100ページごと）
          if (page % 100 === 0) {
            logger.info('取得進捗', {
              page,
              totalRecords,
              progress: `${totalRecords}/${response.total} (${Math.round((totalRecords / response.total) * 100)}%)`,
            })
          }

          // 5. ページ間ディレイ（Rate Limit対策）
          if (hasMore) {
            await sleep(1000)
          }
        } catch (error) {
          logger.error('ページ取得失敗', { page, error: String(error) })
          errors.push({
            type: 'api',
            message: `ページ${page}の取得に失敗`,
            details: { page, error: String(error) },
          })
          break
        }
      }

      // 6. ウォーターマーク更新（取得成功時のみ）
      if (totalRecords > 0) {
        await watermarkManager.update({
          last_fetched_date: endDate.toISOString(),
          last_updated_at: new Date().toISOString(),
        })
        logger.info('ウォーターマーク更新完了', {
          last_fetched_date: endDate.toISOString(),
        })
      }

      const durationMs = Date.now() - startTime

      logger.info('Dify使用量取得完了', {
        success: errors.length === 0,
        totalRecords,
        totalPages,
        durationMs,
        errorCount: errors.length,
      })

      return {
        success: errors.length === 0,
        totalRecords,
        totalPages,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationMs,
        errors,
      }
    },
  }
}

/**
 * ウォーターマークから開始日を計算する
 * @param watermark ウォーターマーク（nullの場合は初回実行）
 * @param config 環境設定
 * @returns 開始日
 */
function calculateStartDate(watermark: Watermark | null, config: EnvConfig): Date {
  if (watermark === null) {
    // 初回実行：過去N日間を取得
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - config.DIFY_INITIAL_FETCH_DAYS)
    return startDate
  }

  // 差分取得：ウォーターマークの翌日から
  const startDate = new Date(watermark.last_fetched_date)
  startDate.setDate(startDate.getDate() + 1)
  return startDate
}

/**
 * Dateを'YYYY-MM-DD'形式に変換する
 * @param date 変換対象の日付
 * @returns YYYY-MM-DD形式の文字列
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * レコードをzodスキーマでバリデーションする
 * @param records バリデーション対象のレコード
 * @param errors エラーを追加するリスト
 * @param logger ログ出力用
 * @returns バリデーション成功したレコード
 */
function validateRecords(
  records: DifyUsageRecord[],
  errors: FetchError[],
  logger: Logger,
): DifyUsageRecord[] {
  const validRecords: DifyUsageRecord[] = []

  for (const record of records) {
    const result = difyUsageRecordSchema.safeParse(record)
    if (result.success) {
      validRecords.push(result.data)
    } else {
      logger.warn('レコードバリデーションエラー', {
        record: {
          date: record.date,
          app_id: record.app_id,
        },
        errors: result.error.errors,
      })
      errors.push({
        type: 'validation',
        message: 'レコードバリデーションエラー',
        details: {
          date: record.date,
          app_id: record.app_id,
          validationErrors: result.error.errors,
        },
      })
    }
  }

  return validRecords
}

/**
 * 指定ミリ秒のスリープ
 * @param ms スリープ時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
