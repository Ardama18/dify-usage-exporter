/**
 * 現在時刻をISO 8601形式（UTC）のタイムスタンプ文字列として取得する
 * @returns ISO 8601形式のタイムスタンプ（例: 2025-01-15T10:30:00.000Z）
 */
export function getCurrentISOTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Date オブジェクトをISO 8601形式（UTC）の文字列に変換する
 * @param date 変換するDateオブジェクト
 * @returns ISO 8601形式のタイムスタンプ文字列
 */
export function formatDateToISO(date: Date): string {
  return date.toISOString()
}
