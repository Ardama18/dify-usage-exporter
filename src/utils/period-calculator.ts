/**
 * 期間計算ユーティリティ
 *
 * DIFY_FETCH_PERIODに基づいて取得期間を計算する。
 * current_month, last_month, current_week, last_week, customに対応。
 */

import type { FetchPeriod } from '../types/env.js'

/**
 * 期間の開始日と終了日
 */
export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * 期間指定モードから取得期間を計算する
 * @param period 期間指定モード
 * @param customStartDate カスタム開始日（YYYY-MM-DD形式、customモード時のみ使用）
 * @param customEndDate カスタム終了日（YYYY-MM-DD形式、customモード時のみ使用）
 * @returns 開始日と終了日
 */
export function calculateDateRange(
  period: FetchPeriod,
  customStartDate?: string,
  customEndDate?: string,
): DateRange {
  const now = new Date()

  switch (period) {
    case 'current_month':
      return getCurrentMonthRange(now)

    case 'last_month':
      return getLastMonthRange(now)

    case 'current_week':
      return getCurrentWeekRange(now)

    case 'last_week':
      return getLastWeekRange(now)

    case 'custom':
      return getCustomRange(customStartDate, customEndDate)

    default:
      // デフォルトは今月
      return getCurrentMonthRange(now)
  }
}

/**
 * 今月の期間を取得
 * @param now 基準日
 * @returns 今月の開始日と終了日
 */
function getCurrentMonthRange(now: Date): DateRange {
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0) // 月末

  return { startDate, endDate }
}

/**
 * 先月の期間を取得
 * @param now 基準日
 * @returns 先月の開始日と終了日
 */
function getLastMonthRange(now: Date): DateRange {
  const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0) // 先月末

  return { startDate, endDate }
}

/**
 * 今週の期間を取得（月曜日始まり）
 * @param now 基準日
 * @returns 今週の開始日と終了日
 */
function getCurrentWeekRange(now: Date): DateRange {
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // 日曜は-6、それ以外は1-dayOfWeek

  const startDate = new Date(now)
  startDate.setDate(now.getDate() + mondayOffset)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6) // 日曜日

  return { startDate, endDate }
}

/**
 * 先週の期間を取得（月曜日始まり）
 * @param now 基準日
 * @returns 先週の開始日と終了日
 */
function getLastWeekRange(now: Date): DateRange {
  const currentWeek = getCurrentWeekRange(now)

  const startDate = new Date(currentWeek.startDate)
  startDate.setDate(startDate.getDate() - 7)

  const endDate = new Date(currentWeek.startDate)
  endDate.setDate(endDate.getDate() - 1)

  return { startDate, endDate }
}

/**
 * カスタム期間を取得
 * @param startDateStr 開始日（YYYY-MM-DD形式）
 * @param endDateStr 終了日（YYYY-MM-DD形式）
 * @returns 開始日と終了日
 */
function getCustomRange(startDateStr?: string, endDateStr?: string): DateRange {
  if (!startDateStr || !endDateStr) {
    throw new Error(
      'カスタム期間の場合はDIFY_FETCH_START_DATEとDIFY_FETCH_END_DATEを指定してください',
    )
  }

  const startDate = parseDate(startDateStr)
  const endDate = parseDate(endDateStr)

  if (startDate > endDate) {
    throw new Error('開始日は終了日より前である必要があります')
  }

  return { startDate, endDate }
}

/**
 * YYYY-MM-DD形式の文字列をDateに変換
 * @param dateStr 日付文字列（YYYY-MM-DD形式）
 * @returns Date
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * DateをYYYY-MM-DD HH:mm形式に変換（Dify API用）
 * @param date 変換対象の日付
 * @param time 時刻（HH:mm形式）
 * @returns YYYY-MM-DD HH:mm形式の文字列
 */
export function formatDateTimeForApi(date: Date, time: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day} ${time}`
}

/**
 * DateをYYYY-MM形式に変換（月単位集計用）
 * @param date 変換対象の日付
 * @returns YYYY-MM形式の文字列
 */
export function formatMonth(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * DateをYYYY-Www形式に変換（週単位集計用、ISO 8601準拠）
 * @param date 変換対象の日付
 * @returns YYYY-Www形式の文字列
 */
export function formatWeek(date: Date): string {
  const year = date.getFullYear()
  const weekNumber = getISOWeekNumber(date)
  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

/**
 * DateをYYYY-MM-DD形式に変換（日単位集計用）
 * @param date 変換対象の日付
 * @returns YYYY-MM-DD形式の文字列
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * ISO 8601の週番号を取得
 * @param date 変換対象の日付
 * @returns 週番号（1-53）
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
