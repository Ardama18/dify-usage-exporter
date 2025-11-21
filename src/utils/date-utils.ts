import { formatISO } from 'date-fns'

/**
 * 現在時刻をISO 8601形式のタイムスタンプ文字列として取得する
 * @returns ISO 8601形式のタイムスタンプ（例: 2025-01-15T10:30:00+09:00）
 */
export function getCurrentISOTimestamp(): string {
  return formatISO(new Date())
}

/**
 * Date オブジェクトをISO 8601形式の文字列に変換する
 * @param date 変換するDateオブジェクト
 * @returns ISO 8601形式のタイムスタンプ文字列
 */
export function formatDateToISO(date: Date): string {
  return formatISO(date, { representation: 'complete' })
}
