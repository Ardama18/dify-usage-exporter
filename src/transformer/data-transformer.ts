import type { ITransformer, TransformError, TransformResult } from '../interfaces/transformer.js'
import type { Logger } from '../logger/winston-logger.js'
import type { DifyUsageRecord } from '../types/dify-usage.js'
import type { ExternalApiRecord } from '../types/external-api.js'
import { externalApiRecordSchema } from '../types/external-api.js'
import { getCurrentISOTimestamp } from '../utils/date-utils.js'
import { generateBatchIdempotencyKey, generateRecordIdempotencyKey } from './idempotency-key.js'

/**
 * Providerを正規化する（小文字変換・空白除去）
 * @param provider 正規化対象のプロバイダー名
 * @returns 正規化されたプロバイダー名
 */
export function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

/**
 * Modelを正規化する（小文字変換・空白除去）
 * @param model 正規化対象のモデル名
 * @returns 正規化されたモデル名
 */
export function normalizeModel(model: string): string {
  return model.trim().toLowerCase()
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
    transform(records: DifyUsageRecord[]): TransformResult {
      const transformedAt = getCurrentISOTimestamp()
      const errors: TransformError[] = []
      const successRecords: ExternalApiRecord[] = []
      const recordKeys: string[] = []

      for (const record of records) {
        try {
          const normalizedProvider = normalizeProvider(record.provider)
          const normalizedModel = normalizeModel(record.model)

          const idempotencyKey = generateRecordIdempotencyKey({
            date: record.date,
            app_id: record.app_id,
            provider: normalizedProvider,
            model: normalizedModel,
          })

          const transformed = {
            date: record.date,
            app_id: record.app_id,
            provider: normalizedProvider,
            model: normalizedModel,
            input_tokens: record.input_tokens,
            output_tokens: record.output_tokens,
            total_tokens: record.total_tokens,
            idempotency_key: idempotencyKey,
            app_name: record.app_name,
            user_id: record.user_id,
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
