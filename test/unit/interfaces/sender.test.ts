import { describe, expect, it } from 'vitest'
import type { ISender } from '../../../src/interfaces/sender.js'
import type { ExternalApiRecord } from '../../../src/types/external-api.js'

describe('ISenderインターフェース', () => {
  it('ISenderインターフェースを実装したクラスがsend()メソッドを持つこと', () => {
    class TestSender implements ISender {
      async send(_records: ExternalApiRecord[]): Promise<void> {
        // テスト用の実装
      }

      async resendSpooled(): Promise<void> {
        // テスト用の実装
      }
    }

    const sender = new TestSender()
    expect(sender.send).toBeDefined()
    expect(typeof sender.send).toBe('function')
  })

  it('ISenderインターフェースを実装したクラスがresendSpooled()メソッドを持つこと', () => {
    class TestSender implements ISender {
      async send(_records: ExternalApiRecord[]): Promise<void> {
        // テスト用の実装
      }

      async resendSpooled(): Promise<void> {
        // テスト用の実装
      }
    }

    const sender = new TestSender()
    expect(sender.resendSpooled).toBeDefined()
    expect(typeof sender.resendSpooled).toBe('function')
  })

  it('send()メソッドがExternalApiRecord配列を受け取れること', async () => {
    class TestSender implements ISender {
      async send(records: ExternalApiRecord[]): Promise<void> {
        expect(Array.isArray(records)).toBe(true)
      }

      async resendSpooled(): Promise<void> {
        // テスト用の実装
      }
    }

    const sender = new TestSender()
    const testRecords: ExternalApiRecord[] = [
      {
        date: '2025-01-21',
        app_id: 'test-app-id',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        idempotency_key: 'test-key',
        transformed_at: '2025-01-21T10:00:00.000Z',
      },
    ]

    await sender.send(testRecords)
  })

  it('resendSpooled()メソッドが引数なしで呼び出せること', async () => {
    class TestSender implements ISender {
      async send(_records: ExternalApiRecord[]): Promise<void> {
        // テスト用の実装
      }

      async resendSpooled(): Promise<void> {
        expect(true).toBe(true) // 引数なしで呼び出されることを確認
      }
    }

    const sender = new TestSender()
    await sender.resendSpooled()
  })
})
