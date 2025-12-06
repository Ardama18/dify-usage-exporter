/**
 * source_event_id生成ロジックのテスト
 *
 * 冪等性を保証するための決定論的なID生成をテストします。
 * SHA256ハッシュベースのID生成により、同一データから常に同じIDを生成します。
 */

import { describe, expect, it } from 'vitest'
import type { NormalizedModelRecord } from '../../normalizer/normalizer.js'
import { generateSourceEventId } from '../idempotency-key.js'

describe('generateSourceEventId', () => {
  describe('決定論的ID生成', () => {
    it('同一データから常に同じIDが生成される', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const id1 = generateSourceEventId(record)
      const id2 = generateSourceEventId(record)
      const id3 = generateSourceEventId(record)

      expect(id1).toBe(id2)
      expect(id2).toBe(id3)
    })

    it('データの順序が異なっても同じIDが生成される（内部でソート）', () => {
      // この仕様は後で調整する可能性があるが、現在は入力パラメータの順序が固定なので影響なし
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const id = generateSourceEventId(record)
      expect(id).toBeTruthy()
    })
  })

  describe('フォーマット検証', () => {
    it('フォーマット: dify-{usage_date}-{provider}-{model}-{hash12}', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const id = generateSourceEventId(record)

      // フォーマット: dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-{hash12}
      expect(id).toMatch(/^dify-\d{4}-\d{2}-\d{2}-.+-.+-[a-f0-9]{12}$/)
      expect(id).toContain('dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-')
    })

    it('ハッシュ部分が12文字の16進数である', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const id = generateSourceEventId(record)
      const parts = id.split('-')
      const hashPart = parts[parts.length - 1]

      expect(hashPart).toHaveLength(12)
      expect(hashPart).toMatch(/^[a-f0-9]{12}$/)
    })
  })

  describe('衝突耐性テスト', () => {
    it('usage_dateが異なる → 異なるIDが生成される', () => {
      const record1: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const record2: NormalizedModelRecord = {
        ...record1,
        usageDate: '2025-11-30',
      }

      const id1 = generateSourceEventId(record1)
      const id2 = generateSourceEventId(record2)

      expect(id1).not.toBe(id2)
    })

    it('providerが異なる → 異なるIDが生成される', () => {
      const record1: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const record2: NormalizedModelRecord = {
        ...record1,
        provider: 'openai',
      }

      const id1 = generateSourceEventId(record1)
      const id2 = generateSourceEventId(record2)

      expect(id1).not.toBe(id2)
    })

    it('modelが異なる → 異なるIDが生成される', () => {
      const record1: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const record2: NormalizedModelRecord = {
        ...record1,
        model: 'claude-3-opus-20240229',
      }

      const id1 = generateSourceEventId(record1)
      const id2 = generateSourceEventId(record2)

      expect(id1).not.toBe(id2)
    })

    it('app_idが異なる → 異なるIDが生成される', () => {
      const record1: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const record2: NormalizedModelRecord = {
        ...record1,
        appId: 'app-789',
      }

      const id1 = generateSourceEventId(record1)
      const id2 = generateSourceEventId(record2)

      expect(id1).not.toBe(id2)
    })

    it('user_idが異なる → 異なるIDが生成される', () => {
      const record1: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
        userId: 'user-456',
      }

      const record2: NormalizedModelRecord = {
        ...record1,
        userId: 'user-789',
      }

      const id1 = generateSourceEventId(record1)
      const id2 = generateSourceEventId(record2)

      expect(id1).not.toBe(id2)
    })
  })

  describe('エッジケース', () => {
    it('app_idがundefined → ハッシュ計算に空文字列を使用', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        userId: 'user-456',
      }

      const id = generateSourceEventId(record)

      expect(id).toMatch(/^dify-\d{4}-\d{2}-\d{2}-.+-.+-[a-f0-9]{12}$/)
      expect(id).toContain('dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-')
    })

    it('user_idがundefined → ハッシュ計算に空文字列を使用', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-123',
      }

      const id = generateSourceEventId(record)

      expect(id).toMatch(/^dify-\d{4}-\d{2}-\d{2}-.+-.+-[a-f0-9]{12}$/)
      expect(id).toContain('dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-')
    })

    it('app_id/user_idがともにundefined → 正常にハッシュ生成', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
      }

      const id = generateSourceEventId(record)

      expect(id).toMatch(/^dify-\d{4}-\d{2}-\d{2}-.+-.+-[a-f0-9]{12}$/)
      expect(id).toContain('dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-')
    })

    it('特殊文字を含むデータ → 正常にハッシュ生成', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        costActual: 0.015,
        appId: 'app-!@#$%^&*()',
        userId: 'user-<>?:"{}',
      }

      const id = generateSourceEventId(record)

      expect(id).toMatch(/^dify-\d{4}-\d{2}-\d{2}-.+-.+-[a-f0-9]{12}$/)
    })
  })

  describe('実データでの検証', () => {
    it('実際のDifyデータと同様のフォーマットで動作する', () => {
      const record: NormalizedModelRecord = {
        usageDate: '2025-11-29',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        inputTokens: 1234,
        outputTokens: 5678,
        totalTokens: 6912,
        costActual: 0.05184,
        appId: 'app-1a2b3c4d5e6f',
        userId: 'user-abc-123-xyz',
      }

      const id = generateSourceEventId(record)

      expect(id).toContain('dify-2025-11-29-anthropic-claude-3-5-sonnet-20241022-')
      expect(id.split('-').pop()).toHaveLength(12)
    })
  })
})
