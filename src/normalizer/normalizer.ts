/**
 * 正規化層統合
 *
 * AggregatedModelRecordをNormalizedModelRecordに変換します。
 * プロバイダー名/モデル名を標準化し、API_Meter送信用のデータ構造に変換します。
 */

import type { AggregatedModelRecord } from '../aggregator/usage-aggregator.js'
import type { Logger } from '../logger/winston-logger.js'
import { createModelNormalizer } from './model-normalizer.js'
import { createProviderNormalizer } from './provider-normalizer.js'

/**
 * 正規化後のモデルレコード（API_Meter送信前の中間形式）
 */
export interface NormalizedModelRecord {
  provider: string // 正規化済みプロバイダー名
  model: string // 正規化済みモデル名
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costActual: number
  usageDate: string // YYYY-MM-DD
  appId?: string
  appName?: string
  userId?: string
}

/**
 * 正規化インターフェース
 */
export interface INormalizer {
  normalize(records: AggregatedModelRecord[]): NormalizedModelRecord[]
}

/**
 * 正規化を実行するインスタンスを作成
 * @param logger - ロガーインスタンス
 * @returns INormalizer
 */
export const createNormalizer = (logger?: Logger): INormalizer => {
  const providerNormalizer = createProviderNormalizer()
  const modelNormalizer = createModelNormalizer()

  return {
    normalize(records: AggregatedModelRecord[]): NormalizedModelRecord[] {
      return records.map((record) => {
        const originalProvider = record.model_provider
        const originalModel = record.model_name
        const normalizedProvider = providerNormalizer.normalize(originalProvider)
        const normalizedModel = modelNormalizer.normalize(originalModel)

        // デバッグログ: 正規化前後の比較
        if (logger) {
          logger.debug('Normalizing model record', {
            original: {
              provider: originalProvider,
              model: originalModel,
            },
            normalized: {
              provider: normalizedProvider,
              model: normalizedModel,
            },
          })
        }

        return {
          provider: normalizedProvider,
          model: normalizedModel,
          inputTokens: record.prompt_tokens,
          outputTokens: record.completion_tokens,
          totalTokens: record.total_tokens,
          costActual: Number.parseFloat(record.total_price),
          usageDate: record.period,
          appId: record.app_id,
          appName: record.app_name,
          userId: record.user_id,
        }
      })
    },
  }
}
