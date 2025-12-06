/**
 * テスト用モックレコード生成ヘルパー
 */
import type { ExternalApiRecord } from '../../src/types/external-api.js'

/**
 * モックExternalApiRecordを生成する
 */
export function createMockExternalApiRecord(
  overrides: Partial<ExternalApiRecord> = {},
): ExternalApiRecord {
  return {
    date: '2025-01-20',
    app_id: 'app1',
    app_name: 'Test App',
    token_count: 100,
    total_price: '0.001',
    currency: 'USD',
    idempotency_key: 'key1',
    transformed_at: '2025-01-20T10:30:00.000Z',
    ...overrides,
  }
}

/**
 * 複数のモックExternalApiRecordを生成する
 */
export function createMockExternalApiRecords(
  count: number,
  baseOverrides: Partial<ExternalApiRecord> = {},
): ExternalApiRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockExternalApiRecord({
      ...baseOverrides,
      app_id: `app${i + 1}`,
      idempotency_key: `key${i + 1}`,
    }),
  )
}
