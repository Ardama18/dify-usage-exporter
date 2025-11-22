/**
 * listコマンド単体テスト
 *
 * createListCommand()関数の単体テスト。
 * SpoolManagerをモックしてテストする。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpoolFile } from '../../../types/spool.js'
import type { CliDependencies } from '../../bootstrap.js'
import { createListCommand } from '../../commands/list.js'

describe('createListCommand', () => {
  let mockDeps: CliDependencies
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // モック依存関係
    mockDeps = {
      config: {} as CliDependencies['config'],
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as CliDependencies['logger'],
      spoolManager: {
        listFailedFiles: vi.fn(),
        deleteFailedFile: vi.fn(),
        getFailedFile: vi.fn(),
      } as unknown as CliDependencies['spoolManager'],
      watermarkManager: {} as unknown as CliDependencies['watermarkManager'],
      externalApiSender: {} as unknown as CliDependencies['externalApiSender'],
    }

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createListCommand()がCommandを返す', () => {
    const command = createListCommand(mockDeps)

    expect(command.name()).toBe('list')
    expect(command.description()).toBe('List failed files in data/failed/')
  })

  it('listFailedFiles()を呼び出す', async () => {
    const mockFiles: SpoolFile[] = []
    vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)

    const command = createListCommand(mockDeps)
    await command.parseAsync([], { from: 'user' })

    expect(mockDeps.spoolManager.listFailedFiles).toHaveBeenCalledTimes(1)
  })

  it('0件の場合「No failed files」を表示', async () => {
    vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue([])

    const command = createListCommand(mockDeps)
    await command.parseAsync([], { from: 'user' })

    expect(consoleSpy).toHaveBeenCalledWith('No failed files')
  })

  it('ファイル一覧をフォーマット表示', async () => {
    const mockFiles: SpoolFile[] = [
      {
        batchIdempotencyKey: 'abc123',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 80,
            output_tokens: 20,
            total_tokens: 100,
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Timeout',
      },
      {
        batchIdempotencyKey: 'def456',
        records: [
          {
            date: '2025-01-21',
            app_id: 'app2',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 160,
            output_tokens: 40,
            total_tokens: 200,
            idempotency_key: 'key2',
            transformed_at: '2025-01-21T14:20:00.000Z',
          },
          {
            date: '2025-01-21',
            app_id: 'app2',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 240,
            output_tokens: 60,
            total_tokens: 300,
            idempotency_key: 'key3',
            transformed_at: '2025-01-21T14:21:00.000Z',
          },
        ],
        firstAttempt: '2025-01-21T14:20:00.000Z',
        retryCount: 10,
        lastError: '500 Error',
      },
    ]
    vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)

    const command = createListCommand(mockDeps)
    await command.parseAsync([], { from: 'user' })

    // ヘッダー表示
    expect(consoleSpy).toHaveBeenCalledWith('Failed files in data/failed/:')
    // 合計表示
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Total: 2 files, 3 records'))
  })

  it('--jsonオプションでJSON出力', async () => {
    const mockFiles: SpoolFile[] = [
      {
        batchIdempotencyKey: 'abc123',
        records: [
          {
            date: '2025-01-20',
            app_id: 'app1',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 80,
            output_tokens: 20,
            total_tokens: 100,
            idempotency_key: 'key1',
            transformed_at: '2025-01-20T10:30:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Timeout',
      },
    ]
    vi.mocked(mockDeps.spoolManager.listFailedFiles).mockResolvedValue(mockFiles)

    const command = createListCommand(mockDeps)
    await command.parseAsync(['--json'], { from: 'user' })

    // JSON出力を検証
    const calls = consoleSpy.mock.calls
    const jsonOutput = calls.find((call: unknown[]) => {
      try {
        JSON.parse(call[0] as string)
        return true
      } catch {
        return false
      }
    })
    expect(jsonOutput).toBeDefined()

    const parsedOutput = JSON.parse(jsonOutput?.[0] as string)
    expect(parsedOutput.files).toHaveLength(1)
    expect(parsedOutput.totalFiles).toBe(1)
    expect(parsedOutput.totalRecords).toBe(1)
  })
})
