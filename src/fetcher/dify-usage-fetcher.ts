/**
 * DifyUsageFetcher
 *
 * Dify Console APIから使用量データを取得するオーケストレーションコンポーネント。
 * 各アプリのtoken-costsエンドポイントからデータを取得し、IFetcherインターフェースを実装。
 */

import type { FetchError, FetchResult, IFetcher } from '../interfaces/fetcher.js'
import type { Logger } from '../logger/winston-logger.js'
import type { DifyAppTokenCost } from '../types/dify-usage.js'
import { difyAppTokenCostSchema } from '../types/dify-usage.js'
import type { EnvConfig } from '../types/env.js'
import type { Watermark } from '../types/watermark.js'
import { calculateDateRange, formatDateTimeForApi } from '../utils/period-calculator.js'
import type { WatermarkManager } from '../watermark/watermark-manager.js'
import type { DifyApiClient, DifyApp } from './dify-api-client.js'

/**
 * 取得したレコード（アプリ情報を含む）
 */
export interface FetchedTokenCostRecord extends DifyAppTokenCost {
  app_id: string
  app_name: string
}

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

      // 1. 取得期間を決定
      let startDate: Date
      let endDate: Date

      if (config.WATERMARK_ENABLED) {
        // ウォーターマーク有効: 前回取得以降のデータを取得
        const watermark = await watermarkManager.load()
        startDate = calculateStartDateFromWatermark(watermark, config)
        endDate = new Date()
      } else {
        // ウォーターマーク無効: DIFY_FETCH_PERIODに基づいて期間を決定
        const dateRange = calculateDateRange(
          config.DIFY_FETCH_PERIOD,
          config.DIFY_FETCH_START_DATE,
          config.DIFY_FETCH_END_DATE
        )
        startDate = dateRange.startDate
        endDate = dateRange.endDate

        logger.info('期間指定モードでデータ取得', {
          period: config.DIFY_FETCH_PERIOD,
          aggregation: config.DIFY_AGGREGATION_PERIOD,
          outputMode: config.DIFY_OUTPUT_MODE,
        })
      }

      logger.info('Dify使用量取得開始', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      // 日時文字列を生成（YYYY-MM-DD HH:mm形式）
      const startStr = formatDateTimeForApi(startDate, '00:00')
      const endStr = formatDateTimeForApi(endDate, '23:59')

      try {
        // 2. アプリ一覧取得
        const apps = await client.fetchApps()
        logger.info('アプリ一覧取得完了', { count: apps.length })

        // 3. 各アプリのtoken-costsを取得
        for (const app of apps) {
          try {
            const response = await client.fetchAppTokenCosts({
              appId: app.id,
              start: startStr,
              end: endStr,
            })

            // 4. バリデーションとレコード変換
            const validRecords = validateAndEnrichRecords(response.data, app, errors, logger)

            if (validRecords.length > 0) {
              await onRecords(validRecords)
              totalRecords += validRecords.length
            }

            logger.debug('アプリtoken-costs取得完了', {
              appId: app.id,
              appName: app.name,
              recordCount: validRecords.length,
            })

            // Rate Limit対策のディレイ
            await sleep(500)
          } catch (error) {
            logger.error('アプリtoken-costs取得失敗', {
              appId: app.id,
              appName: app.name,
              error: String(error),
            })
            errors.push({
              type: 'api',
              message: `アプリ${app.name}のtoken-costs取得に失敗`,
              details: { appId: app.id, error: String(error) },
            })
          }
        }

        // 5. ウォーターマーク更新（有効時かつ取得成功時のみ）
        if (config.WATERMARK_ENABLED && totalRecords > 0) {
          await watermarkManager.update({
            last_fetched_date: endDate.toISOString(),
            last_updated_at: new Date().toISOString(),
          })
          logger.info('ウォーターマーク更新完了', {
            last_fetched_date: endDate.toISOString(),
          })
        }
      } catch (error) {
        logger.error('Dify使用量取得失敗', { error: String(error) })
        errors.push({
          type: 'api',
          message: 'アプリ一覧の取得に失敗',
          details: { error: String(error) },
        })
      }

      const durationMs = Date.now() - startTime

      logger.info('Dify使用量取得完了', {
        success: errors.length === 0,
        totalRecords,
        durationMs,
        errorCount: errors.length,
      })

      return {
        success: errors.length === 0,
        totalRecords,
        totalPages: 1, // アプリベースなのでページングは使用しない
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
function calculateStartDateFromWatermark(watermark: Watermark | null, config: EnvConfig): Date {
  if (watermark === null) {
    // 初回実行：過去N日間を取得
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - config.DIFY_FETCH_DAYS)
    return startDate
  }

  // 差分取得：ウォーターマークの翌日から
  const startDate = new Date(watermark.last_fetched_date)
  startDate.setDate(startDate.getDate() + 1)
  return startDate
}

/**
 * レコードをzodスキーマでバリデーションし、アプリ情報を付加する
 * @param records バリデーション対象のレコード
 * @param app アプリ情報
 * @param errors エラーを追加するリスト
 * @param logger ログ出力用
 * @returns バリデーション成功したレコード（アプリ情報付き）
 */
function validateAndEnrichRecords(
  records: DifyAppTokenCost[],
  app: DifyApp,
  errors: FetchError[],
  logger: Logger
): FetchedTokenCostRecord[] {
  const validRecords: FetchedTokenCostRecord[] = []

  for (const record of records) {
    const result = difyAppTokenCostSchema.safeParse(record)
    if (result.success) {
      validRecords.push({
        ...result.data,
        app_id: app.id,
        app_name: app.name,
      })
    } else {
      logger.warn('レコードバリデーションエラー', {
        record: {
          date: record.date,
          app_id: app.id,
        },
        errors: result.error.errors,
      })
      errors.push({
        type: 'validation',
        message: 'レコードバリデーションエラー',
        details: {
          date: record.date,
          app_id: app.id,
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
