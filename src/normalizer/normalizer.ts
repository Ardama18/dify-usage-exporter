/**
 * 正規化層統合
 *
 * AggregatedModelRecordをNormalizedModelRecordに変換します。
 * プロバイダー名/モデル名を標準化し、API_Meter送信用のデータ構造に変換します。
 */

import type { AggregatedModelRecord } from '../aggregator/usage-aggregator.js'
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
 * @returns INormalizer
 */
export const createNormalizer = (): INormalizer => {
  const providerNormalizer = createProviderNormalizer()
  const modelNormalizer = createModelNormalizer()

  return {
    normalize(records: AggregatedModelRecord[]): NormalizedModelRecord[] {
      return records.map((record) => ({
        provider: providerNormalizer.normalize(record.model_provider),
        model: modelNormalizer.normalize(record.model_name),
        inputTokens: record.prompt_tokens,
        outputTokens: record.completion_tokens,
        totalTokens: record.total_tokens,
        costActual: Number.parseFloat(record.total_price),
        usageDate: record.period,
        appId: record.app_id,
        userId: record.user_id,
      }))
    },
  }
}
