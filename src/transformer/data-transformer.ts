import type { ITransformer, TransformError, TransformResult } from '../interfaces/transformer.js'
import type { Logger } from '../logger/winston-logger.js'
import type { ExternalApiRecord } from '../types/external-api.js'
import { externalApiRecordSchema } from '../types/external-api.js'
import { getCurrentISOTimestamp } from '../utils/date-utils.js'
import { generateBatchIdempotencyKey, generateRecordIdempotencyKey } from './idempotency-key.js'

/**
 * Fetcherから受け取るレコード形式（token-costs + アプリ情報）
 */
export interface TokenCostInputRecord {
  date: string
  token_count: number
  total_price: string
  currency: string
  app_id: string
  app_name: string
}

/**
 * DataTransformerの依存性
 */
export interface TransformerDeps {
  logger: Logger
}

/**
 * DataTransformerファクトリ関数
 * ITransformerインターフェースを実装する変換機能を提供
 *
 * @param deps 依存性（Logger）
 * @returns ITransformer実装
 */
export function createDataTransformer(deps: TransformerDeps): ITransformer {
  return {
    transform(records: TokenCostInputRecord[]): TransformResult {
      const transformedAt = getCurrentISOTimestamp()
      const errors: TransformError[] = []
      const successRecords: ExternalApiRecord[] = []
      const recordKeys: string[] = []

      for (const record of records) {
        try {
          const idempotencyKey = generateRecordIdempotencyKey({
            date: record.date,
            app_id: record.app_id,
          })

          const transformed = {
            date: record.date,
            app_id: record.app_id,
            app_name: record.app_name,
            token_count: record.token_count,
            total_price: record.total_price,
            currency: record.currency,
            idempotency_key: idempotencyKey,
            transformed_at: transformedAt,
          }

          const validation = externalApiRecordSchema.safeParse(transformed)

          if (validation.success) {
            successRecords.push(validation.data)
            recordKeys.push(idempotencyKey)
          } else {
            errors.push({
              recordIdentifier: { date: record.date, app_id: record.app_id },
              message: '出力バリデーションエラー',
              details: { errors: validation.error.errors },
            })
          }
        } catch (error) {
          errors.push({
            recordIdentifier: { date: record.date, app_id: record.app_id },
            message: '変換処理エラー',
            details: { error: String(error) },
          })
        }
      }

      const batchIdempotencyKey = generateBatchIdempotencyKey(recordKeys)

      deps.logger.info('Transform completed', {
        successCount: successRecords.length,
        errorCount: errors.length,
        batchIdempotencyKey,
      })

      return {
        records: successRecords,
        batchIdempotencyKey,
        successCount: successRecords.length,
        errorCount: errors.length,
        errors,
      }
    },
  }
}
