/**
 * 使用量データ集計
 *
 * 日別のトークンコストデータを月/週/日単位に集約し、
 * アプリ毎/ワークスペース全体の集計を行う。
 */

import type { AggregationPeriod, OutputMode } from '../types/env.js'
import { formatDate, formatMonth, formatWeek } from '../utils/period-calculator.js'

/**
 * 集計前のレコード（アプリ別・日別）
 */
export interface RawTokenCostRecord {
  date: string // YYYY-MM-DD
  app_id: string
  app_name: string
  token_count: number
  total_price: string // "0.0197304"
  currency: string
}

/**
 * 集計後のレコード（アプリ別）
 */
export interface AggregatedAppRecord {
  period: string // YYYY-MM（月）, YYYY-Www（週）, YYYY-MM-DD（日）
  period_type: AggregationPeriod
  app_id: string
  app_name: string
  token_count: number
  total_price: string
  currency: string
}

/**
 * 集計後のレコード（ワークスペース全体）
 */
export interface AggregatedWorkspaceRecord {
  period: string
  period_type: AggregationPeriod
  type: 'workspace_total'
  token_count: number
  total_price: string
  currency: string
}

/**
 * 集計後のレコード（ユーザー別）
 */
export interface AggregatedUserRecord {
  period: string
  period_type: AggregationPeriod
  user_id: string
  user_type: 'end_user' | 'account'
  app_id: string
  app_name: string
  message_tokens: number
  answer_tokens: number
  total_tokens: number
  message_count: number
  conversation_count: number
}

/**
 * ユーザー別集計用の入力レコード
 */
export interface RawUserUsageRecord {
  date: string // YYYY-MM-DD
  user_id: string
  user_type: 'end_user' | 'account'
  app_id: string
  app_name: string
  message_tokens: number
  answer_tokens: number
  total_tokens: number
  conversation_id: string
}

/**
 * モデル別集計用の入力レコード（ノード実行詳細から）
 */
export interface RawModelUsageRecord {
  date: string // YYYY-MM-DD
  user_id: string
  user_type: 'end_user' | 'account'
  app_id: string
  app_name: string
  model_provider: string
  model_name: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_price: number
  completion_price: number
  total_price: number
  currency: string
}

/**
 * 集計後のレコード（モデル別）
 */
export interface AggregatedModelRecord {
  period: string
  period_type: AggregationPeriod
  user_id: string
  user_type: 'end_user' | 'account'
  app_id: string
  app_name: string
  model_provider: string
  model_name: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_price: string
  completion_price: string
  total_price: string
  currency: string
  execution_count: number
}

/**
 * 集計結果
 */
export interface AggregationResult {
  appRecords: AggregatedAppRecord[]
  workspaceRecords: AggregatedWorkspaceRecord[]
  userRecords: AggregatedUserRecord[]
  modelRecords: AggregatedModelRecord[]
}

/**
 * 使用量データを集計する
 * @param records 日別のトークンコストレコード
 * @param aggregationPeriod 集計周期（monthly/weekly/daily）
 * @param outputMode 出力モード（per_app/workspace/both/per_user/per_model/all）
 * @param userRecords ユーザー別レコード（per_user/allモードで使用）
 * @param modelRecords モデル別レコード（per_model/allモードで使用）
 * @returns 集計結果
 */
export function aggregateUsageData(
  records: RawTokenCostRecord[],
  aggregationPeriod: AggregationPeriod,
  outputMode: OutputMode,
  userRecords?: RawUserUsageRecord[],
  modelRecords?: RawModelUsageRecord[]
): AggregationResult {
  const result: AggregationResult = {
    appRecords: [],
    workspaceRecords: [],
    userRecords: [],
    modelRecords: [],
  }

  // 出力モードに応じて集計を実行
  if (outputMode === 'per_app' || outputMode === 'both' || outputMode === 'all') {
    if (records.length > 0) {
      result.appRecords = aggregateByApp(records, aggregationPeriod)
    }
  }

  if (outputMode === 'workspace' || outputMode === 'both' || outputMode === 'all') {
    if (records.length > 0) {
      result.workspaceRecords = aggregateWorkspaceTotal(records, aggregationPeriod)
    }
  }

  if (outputMode === 'per_user' || outputMode === 'all') {
    if (userRecords && userRecords.length > 0) {
      result.userRecords = aggregateByUser(userRecords, aggregationPeriod)
    }
  }

  if (outputMode === 'per_model' || outputMode === 'all') {
    if (modelRecords && modelRecords.length > 0) {
      result.modelRecords = aggregateByModel(modelRecords, aggregationPeriod)
    }
  }

  return result
}

/**
 * アプリ別に集計
 * @param records 日別レコード
 * @param aggregationPeriod 集計周期
 * @returns アプリ別集計レコード
 */
function aggregateByApp(
  records: RawTokenCostRecord[],
  aggregationPeriod: AggregationPeriod
): AggregatedAppRecord[] {
  // キー: "period|app_id"
  const aggregated = new Map<
    string,
    { tokens: number; price: number; appName: string; currency: string }
  >()

  for (const record of records) {
    const period = getPeriodKey(record.date, aggregationPeriod)
    const key = `${period}|${record.app_id}`

    const existing = aggregated.get(key) || {
      tokens: 0,
      price: 0,
      appName: record.app_name,
      currency: record.currency,
    }

    existing.tokens += record.token_count
    existing.price += Number.parseFloat(record.total_price)
    aggregated.set(key, existing)
  }

  // Mapを配列に変換
  const result: AggregatedAppRecord[] = []
  for (const [key, data] of aggregated) {
    const [period, appId] = key.split('|')
    result.push({
      period,
      period_type: aggregationPeriod,
      app_id: appId,
      app_name: data.appName,
      token_count: data.tokens,
      total_price: data.price.toFixed(7),
      currency: data.currency,
    })
  }

  // 期間とアプリIDでソート
  result.sort((a, b) => {
    const periodCompare = a.period.localeCompare(b.period)
    if (periodCompare !== 0) return periodCompare
    return a.app_id.localeCompare(b.app_id)
  })

  return result
}

/**
 * ワークスペース全体で集計
 * @param records 日別レコード
 * @param aggregationPeriod 集計周期
 * @returns ワークスペース全体集計レコード
 */
function aggregateWorkspaceTotal(
  records: RawTokenCostRecord[],
  aggregationPeriod: AggregationPeriod
): AggregatedWorkspaceRecord[] {
  // キー: "period"
  const aggregated = new Map<string, { tokens: number; price: number; currency: string }>()

  for (const record of records) {
    const period = getPeriodKey(record.date, aggregationPeriod)

    const existing = aggregated.get(period) || {
      tokens: 0,
      price: 0,
      currency: record.currency,
    }

    existing.tokens += record.token_count
    existing.price += Number.parseFloat(record.total_price)
    aggregated.set(period, existing)
  }

  // Mapを配列に変換
  const result: AggregatedWorkspaceRecord[] = []
  for (const [period, data] of aggregated) {
    result.push({
      period,
      period_type: aggregationPeriod,
      type: 'workspace_total',
      token_count: data.tokens,
      total_price: data.price.toFixed(7),
      currency: data.currency,
    })
  }

  // 期間でソート
  result.sort((a, b) => a.period.localeCompare(b.period))

  return result
}

/**
 * ユーザー別に集計
 * @param records ユーザー別レコード
 * @param aggregationPeriod 集計周期
 * @returns ユーザー別集計レコード
 */
function aggregateByUser(
  records: RawUserUsageRecord[],
  aggregationPeriod: AggregationPeriod
): AggregatedUserRecord[] {
  // キー: "period|user_id|app_id"
  const aggregated = new Map<
    string,
    {
      userType: 'end_user' | 'account'
      appName: string
      messageTokens: number
      answerTokens: number
      totalTokens: number
      messageCount: number
      conversationIds: Set<string>
    }
  >()

  for (const record of records) {
    const period = getPeriodKey(record.date, aggregationPeriod)
    const key = `${period}|${record.user_id}|${record.app_id}`

    const existing = aggregated.get(key) || {
      userType: record.user_type,
      appName: record.app_name,
      messageTokens: 0,
      answerTokens: 0,
      totalTokens: 0,
      messageCount: 0,
      conversationIds: new Set<string>(),
    }

    existing.messageTokens += record.message_tokens
    existing.answerTokens += record.answer_tokens
    existing.totalTokens += record.total_tokens
    existing.messageCount += 1
    existing.conversationIds.add(record.conversation_id)
    aggregated.set(key, existing)
  }

  // Mapを配列に変換
  const result: AggregatedUserRecord[] = []
  for (const [key, data] of aggregated) {
    const [period, userId, appId] = key.split('|')
    result.push({
      period,
      period_type: aggregationPeriod,
      user_id: userId,
      user_type: data.userType,
      app_id: appId,
      app_name: data.appName,
      message_tokens: data.messageTokens,
      answer_tokens: data.answerTokens,
      total_tokens: data.totalTokens,
      message_count: data.messageCount,
      conversation_count: data.conversationIds.size,
    })
  }

  // 期間、ユーザーID、アプリIDでソート
  result.sort((a, b) => {
    const periodCompare = a.period.localeCompare(b.period)
    if (periodCompare !== 0) return periodCompare
    const userCompare = a.user_id.localeCompare(b.user_id)
    if (userCompare !== 0) return userCompare
    return a.app_id.localeCompare(b.app_id)
  })

  return result
}

/**
 * モデル別に集計
 * @param records モデル別レコード
 * @param aggregationPeriod 集計周期
 * @returns モデル別集計レコード
 */
function aggregateByModel(
  records: RawModelUsageRecord[],
  aggregationPeriod: AggregationPeriod
): AggregatedModelRecord[] {
  // キー: "period|user_id|app_id|model_provider|model_name"
  const aggregated = new Map<
    string,
    {
      userType: 'end_user' | 'account'
      appName: string
      promptTokens: number
      completionTokens: number
      totalTokens: number
      promptPrice: number
      completionPrice: number
      totalPrice: number
      currency: string
      executionCount: number
    }
  >()

  for (const record of records) {
    const period = getPeriodKey(record.date, aggregationPeriod)
    const key = `${period}|${record.user_id}|${record.app_id}|${record.model_provider}|${record.model_name}`

    const existing = aggregated.get(key) || {
      userType: record.user_type,
      appName: record.app_name,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      promptPrice: 0,
      completionPrice: 0,
      totalPrice: 0,
      currency: record.currency,
      executionCount: 0,
    }

    existing.promptTokens += record.prompt_tokens
    existing.completionTokens += record.completion_tokens
    existing.totalTokens += record.total_tokens
    existing.promptPrice += record.prompt_price
    existing.completionPrice += record.completion_price
    existing.totalPrice += record.total_price
    existing.executionCount += 1
    aggregated.set(key, existing)
  }

  // Mapを配列に変換
  const result: AggregatedModelRecord[] = []
  for (const [key, data] of aggregated) {
    const [period, userId, appId, modelProvider, modelName] = key.split('|')
    result.push({
      period,
      period_type: aggregationPeriod,
      user_id: userId,
      user_type: data.userType,
      app_id: appId,
      app_name: data.appName,
      model_provider: modelProvider,
      model_name: modelName,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      total_tokens: data.totalTokens,
      prompt_price: data.promptPrice.toFixed(7),
      completion_price: data.completionPrice.toFixed(7),
      total_price: data.totalPrice.toFixed(7),
      currency: data.currency,
      execution_count: data.executionCount,
    })
  }

  // 期間、ユーザーID、モデル名でソート
  result.sort((a, b) => {
    const periodCompare = a.period.localeCompare(b.period)
    if (periodCompare !== 0) return periodCompare
    const userCompare = a.user_id.localeCompare(b.user_id)
    if (userCompare !== 0) return userCompare
    const modelCompare = a.model_name.localeCompare(b.model_name)
    if (modelCompare !== 0) return modelCompare
    return a.app_id.localeCompare(b.app_id)
  })

  return result
}

/**
 * 日付から集計期間キーを取得
 * @param dateStr YYYY-MM-DD形式の日付
 * @param aggregationPeriod 集計周期
 * @returns 期間キー（YYYY-MM, YYYY-Www, YYYY-MM-DD）
 */
function getPeriodKey(dateStr: string, aggregationPeriod: AggregationPeriod): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  switch (aggregationPeriod) {
    case 'monthly':
      return formatMonth(date)
    case 'weekly':
      return formatWeek(date)
    case 'daily':
      return formatDate(date)
    default:
      return formatMonth(date)
  }
}
