import { loadConfig } from '../config/env-config.js'
import type { Logger } from '../logger/winston-logger.js'
import type { NormalizedModelRecord } from '../normalizer/normalizer.js'
import type { ApiMeterRequest, ApiMeterUsageRecord } from '../types/api-meter-schema.js'
import { apiMeterRequestSchema } from '../types/api-meter-schema.js'
import { generateSourceEventId } from './idempotency-key.js'

/**
 * 変換結果（新仕様）
 */
export interface TransformResult {
  request: ApiMeterRequest
  recordCount: number
}

/**
 * DataTransformerの依存性
 */
export interface TransformerDeps {
  logger: Logger
}

/**
 * レコードから最も古い日付を取得（ISO8601形式）
 *
 * @param records 正規化済みモデルレコード配列
 * @returns 最も古い日付のISO8601文字列
 */
const getDateRangeStart = (records: NormalizedModelRecord[]): string => {
  const dates = records.map((r) => new Date(r.usageDate))
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  return minDate.toISOString()
}

/**
 * レコードから最も新しい日付を取得（ISO8601形式）
 *
 * @param records 正規化済みモデルレコード配列
 * @returns 最も新しい日付のISO8601文字列
 */
const getDateRangeEnd = (records: NormalizedModelRecord[]): string => {
  const dates = records.map((r) => new Date(r.usageDate))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
  return maxDate.toISOString()
}

/**
 * DataTransformerファクトリ関数
 * NormalizedModelRecord[] → ApiMeterRequest への変換を実行
 *
 * @param deps 依存性（Logger）
 * @returns ITransformer実装
 */
export function createDataTransformer(deps: TransformerDeps) {
  return {
    transform(records: NormalizedModelRecord[]): TransformResult {
      if (records.length === 0) {
        throw new Error('No records to transform')
      }

      const env = loadConfig()

      // NormalizedModelRecord → ApiMeterUsageRecord への変換
      const usageRecords: ApiMeterUsageRecord[] = records.map((record) => {
        // トークン計算検証
        const totalTokens = record.inputTokens + record.outputTokens
        if (totalTokens !== record.totalTokens) {
          throw new Error(
            `Token mismatch: ${record.totalTokens} !== ${totalTokens} (${record.inputTokens} + ${record.outputTokens})`,
          )
        }

        return {
          usage_date: record.usageDate,
          provider: record.provider,
          model: record.model,
          input_tokens: record.inputTokens,
          output_tokens: record.outputTokens,
          total_tokens: record.totalTokens,
          request_count: 1, // 日別集計のため1固定
          cost_actual: record.costActual,
          currency: 'USD',
          metadata: {
            source_system: 'dify' as const,
            source_event_id: generateSourceEventId(record),
            source_app_id: record.appId,
            aggregation_method: 'daily_sum',
          },
        }
      })

      // ApiMeterRequestの構築
      const request: ApiMeterRequest = {
        tenant_id: env.API_METER_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: new Date().toISOString(),
          aggregation_period: 'daily' as const,
          date_range: {
            start: getDateRangeStart(records),
            end: getDateRangeEnd(records),
          },
        },
        records: usageRecords,
      }

      // zodスキーマでバリデーション
      const validatedRequest = apiMeterRequestSchema.parse(request)

      deps.logger.info('Transform completed', {
        recordCount: usageRecords.length,
        tenant_id: env.API_METER_TENANT_ID,
        date_range: request.export_metadata.date_range,
      })

      return {
        request: validatedRequest,
        recordCount: usageRecords.length,
      }
    },
  }
}
