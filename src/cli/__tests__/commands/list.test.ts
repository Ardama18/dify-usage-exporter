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

/**
 * v2.0.0形式のテスト用SpoolFileを作成するヘルパー関数
 */
function createMockSpoolFile(
  records: Array<{
    usage_date: string
    provider: string
    model: string
    input_tokens: number
    output_tokens: number
    total_tokens: number
    request_count: number
    cost_actual: number
    app_id?: string
    app_name?: string
  }>,
  options: { createdAt?: string; retryCount?: number } = {},
): SpoolFile {
  return {
    version: '2.0.0',
    data: {
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      export_metadata: {
        exporter_version: '1.1.0',
        export_timestamp: options.createdAt || new Date().toISOString(),
        aggregation_period: 'daily',
        source_system: 'dify',
        date_range: {
          start: records[0]?.usage_date
            ? `${records[0].usage_date}T00:00:00.000Z`
            : new Date().toISOString(),
          end: records[0]?.usage_date
            ? `${records[0].usage_date}T23:59:59.999Z`
            : new Date().toISOString(),
        },
      },
      records: records.map((r) => ({
        usage_date: r.usage_date,
        provider: r.provider,
        model: r.model,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        total_tokens: r.total_tokens,
        request_count: r.request_count,
        cost_actual: r.cost_actual,
        currency: 'USD',
        metadata: {
          source_system: 'dify' as const,
          source_event_id: `test-${r.usage_date}`,
          source_app_id: r.app_id || 'test-app',
          source_app_name: r.app_name || 'Test App',
          aggregation_method: 'daily_sum',
        },
      })),
    },
    createdAt: options.createdAt || new Date().toISOString(),
    retryCount: options.retryCount ?? 0,
  }
}

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
      createMockSpoolFile(
        [
          {
            usage_date: '2025-01-20',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            app_id: 'app1',
            app_name: 'Test App 1',
          },
        ],
        { createdAt: '2025-01-20T10:30:00.000Z', retryCount: 10 },
      ),
      createMockSpoolFile(
        [
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 200,
            output_tokens: 100,
            total_tokens: 300,
            request_count: 1,
            cost_actual: 0.002,
            app_id: 'app2',
            app_name: 'Test App 2',
          },
          {
            usage_date: '2025-01-21',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 300,
            output_tokens: 100,
            total_tokens: 400,
            request_count: 1,
            cost_actual: 0.003,
            app_id: 'app2',
            app_name: 'Test App 2',
          },
        ],
        { createdAt: '2025-01-21T14:20:00.000Z', retryCount: 10 },
      ),
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
      createMockSpoolFile(
        [
          {
            usage_date: '2025-01-20',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
            request_count: 1,
            cost_actual: 0.001,
            app_id: 'app1',
            app_name: 'Test App 1',
          },
        ],
        { createdAt: '2025-01-20T10:30:00.000Z', retryCount: 10 },
      ),
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
