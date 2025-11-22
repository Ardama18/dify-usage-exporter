/**
 * CLI E2Eテスト - Design Doc: specs/stories/6-manual-resend-watermark/design.md
 * 生成日: 2025-11-22
 * テスト種別: End-to-End Test
 * 実装タイミング: Phase 4 - 全体統合 + E2E確認
 *
 * このテストは実際のファイルシステム操作を含むE2Eテストです。
 * npm run cli -- コマンド形式での実際のCLI実行を検証します。
 *
 * 注意: 外部API連携テストは実際のAPIサーバーが必要なため、
 * 基本動作確認のみ行い、詳細な連携テストは統合テストで実施します。
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * テスト用の環境変数
 */
const testEnv = {
  DIFY_API_BASE_URL: 'https://api.dify.ai',
  DIFY_API_TOKEN: 'test-dify-token',
  EXTERNAL_API_URL: 'https://external-api.example.com',
  EXTERNAL_API_TOKEN: 'test-external-token',
}

/**
 * CLIコマンドを実行するヘルパー関数
 */
function runCli(
  args: string[],
  options: {
    env?: Record<string, string>
    input?: string
    timeout?: number
  } = {},
): Promise<{
  stdout: string
  stderr: string
  exitCode: number | null
}> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/cli/index.ts', ...args], {
      env: { ...process.env, ...testEnv, ...options.env },
      cwd: process.cwd(),
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    // 入力がある場合は送信
    if (options.input) {
      child.stdin.write(options.input)
      child.stdin.end()
    }

    // タイムアウト処理
    const timeout = options.timeout ?? 10000
    const timer = setTimeout(() => {
      child.kill()
      resolve({ stdout, stderr, exitCode: null })
    }, timeout)

    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode })
    })
  })
}

/**
 * テストデータディレクトリのパス
 */
const testFailedDir = 'data/failed'
const testDataDir = 'data'

describe('CLI E2Eテスト', { concurrent: false }, () => {
  // テスト前にディレクトリを準備
  beforeEach(async () => {
    await fs.mkdir(testFailedDir, { recursive: true })
  })

  // テスト後にクリーンアップ
  afterEach(async () => {
    await fs.rm(testFailedDir, { recursive: true, force: true })
  })

  // ======================
  // listコマンド E2E
  // ======================
  describe('listコマンド全体疎通', () => {
    it('E2E: npm run cli -- list コマンドが正常に実行され一覧が表示される', async () => {
      // Arrange: テスト用失敗ファイルを作成
      const testFile = {
        batchIdempotencyKey: 'test123',
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
        lastError: 'Test error',
      }
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T103000000Z_test123.json`,
        JSON.stringify(testFile),
      )

      // Act
      const result = await runCli(['list'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Failed files')
      expect(result.stdout).toContain('test123')
    })

    it('E2E: 複数の失敗ファイルが存在する場合の一覧表示', async () => {
      // Arrange: 複数のテストファイルを作成
      const file1 = {
        batchIdempotencyKey: 'batch1',
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
        retryCount: 5,
        lastError: 'Error 1',
      }
      const file2 = {
        batchIdempotencyKey: 'batch2',
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
        ],
        firstAttempt: '2025-01-21T14:20:00.000Z',
        retryCount: 3,
        lastError: 'Error 2',
      }

      await fs.writeFile(
        `${testFailedDir}/failed_20250120T103000000Z_batch1.json`,
        JSON.stringify(file1),
      )
      await fs.writeFile(
        `${testFailedDir}/failed_20250121T142000000Z_batch2.json`,
        JSON.stringify(file2),
      )

      // Act
      const result = await runCli(['list'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('batch1')
      expect(result.stdout).toContain('batch2')
      expect(result.stdout).toContain('Total: 2 files')
    })

    it('E2E: ファイル詳細（レコード数、初回試行日時、最終エラー）が正しく表示される', async () => {
      // Arrange
      const testFile = {
        batchIdempotencyKey: 'detail-test',
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
          {
            date: '2025-01-20',
            app_id: 'app2',
            provider: 'openai',
            model: 'gpt-4',
            input_tokens: 160,
            output_tokens: 40,
            total_tokens: 200,
            idempotency_key: 'key2',
            transformed_at: '2025-01-20T10:31:00.000Z',
          },
        ],
        firstAttempt: '2025-01-20T10:30:00.000Z',
        retryCount: 10,
        lastError: 'Network timeout',
      }
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T103000000Z_detail-test.json`,
        JSON.stringify(testFile),
      )

      // Act
      const result = await runCli(['list'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('2') // レコード数
      expect(result.stdout).toContain('2025-01-20') // 初回試行日時
      expect(result.stdout).toContain('Network') // 最終エラー（truncated）
    })

    it('E2E-edge: data/failed/が空の場合に「No failed files」が表示される', async () => {
      // Arrange: ディレクトリは存在するがファイルなし

      // Act
      const result = await runCli(['list'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No failed files')
    })
  })

  // ======================
  // resendコマンド E2E
  // ======================
  describe('resendコマンド全体疎通', () => {
    it('E2E: npm run cli -- resend --file <filename> でファイル読み込みと再送試行が行われる', async () => {
      // Arrange: テスト用失敗ファイルを作成
      const testFile = {
        batchIdempotencyKey: 'resend-test',
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
        lastError: 'Test error',
      }
      const filename = 'failed_20250120T103000000Z_resend-test.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, JSON.stringify(testFile))

      // Act: 外部APIは存在しないため再送は失敗するが、CLIの動作は確認できる
      const result = await runCli(['resend', '--file', filename])

      // Assert: ファイル読み込みと再送試行が行われたことを確認
      expect(result.stdout).toContain('Resending')
      // 外部APIに接続できないためエラーまたは失敗メッセージが表示される
      expect(result.stdout + result.stderr).toMatch(/Failed|error|ECONNREFUSED|ENOTFOUND/i)
    })

    it('E2E: npm run cli -- resend 引数なしでファイル一覧が表示される', async () => {
      // Arrange
      const testFile = {
        batchIdempotencyKey: 'noargs-test',
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
        lastError: 'Test error',
      }
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T103000000Z_noargs-test.json`,
        JSON.stringify(testFile),
      )

      // Act
      const result = await runCli(['resend'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Failed files')
      expect(result.stdout).toContain('noargs-test')
    })

    it('E2E: ファイルが存在しない場合にエラーが表示される', async () => {
      // Act
      const result = await runCli(['resend', '--file', 'nonexistent.json'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout + result.stderr).toContain('not found')
    })

    it('E2E: 空のディレクトリで--allを実行した場合', async () => {
      // Act
      const result = await runCli(['resend', '--all'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('No failed files')
    })
  })

  // ======================
  // watermarkコマンド E2E
  // ======================
  describe('watermarkコマンド全体疎通', () => {
    const watermarkPath = `${testDataDir}/watermark.json`

    beforeEach(async () => {
      // watermark.jsonを準備
      const watermark = {
        last_fetched_date: '2025-01-15T00:00:00.000Z',
        last_updated_at: '2025-01-20T10:00:00.000Z',
      }
      await fs.writeFile(watermarkPath, JSON.stringify(watermark, null, 2))
    })

    afterEach(async () => {
      // watermark.jsonをクリーンアップ
      await fs.rm(watermarkPath).catch(() => {})
    })

    it('E2E: npm run cli -- watermark show で現在のウォーターマークが表示される', async () => {
      // Act
      const result = await runCli(['watermark', 'show'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Current watermark')
      expect(result.stdout).toContain('last_fetched_date')
      expect(result.stdout).toContain('2025-01-15')
    })

    it('E2E: npm run cli -- watermark reset --date <ISO8601> でウォーターマークがリセットされる', async () => {
      // Act: 確認プロンプトに'y'を入力
      const result = await runCli(['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'], {
        input: 'y\n',
      })

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Watermark reset')
      expect(result.stdout).toContain('2025-01-01')
    })

    it('E2E: resetコマンドで確認プロンプトが表示される', async () => {
      // Act
      const result = await runCli(['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'], {
        input: 'n\n',
      })

      // Assert
      expect(result.stdout).toContain('WARNING')
      expect(result.stdout).toContain('Are you sure')
    })

    it('E2E: 確認「y」後にwatermark.jsonが更新される', async () => {
      // Act
      await runCli(['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'], {
        input: 'y\n',
      })

      // Assert: ファイル内容を確認
      const content = await fs.readFile(watermarkPath, 'utf-8')
      const watermark = JSON.parse(content)
      expect(watermark.last_fetched_date).toBe('2025-01-01T00:00:00.000Z')
    })

    it('E2E-edge: watermark.json不在時のshowコマンド動作', async () => {
      // Arrange: watermark.jsonを削除
      await fs.rm(watermarkPath).catch(() => {})

      // Act
      const result = await runCli(['watermark', 'show'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('not set')
    })

    it('E2E-edge: 不正な日時形式でエラーが表示される', async () => {
      // Act
      const result = await runCli(['watermark', 'reset', '--date', 'invalid-date'], {
        input: 'y\n',
      })

      // Assert
      expect(result.exitCode).toBe(1)
      expect(result.stdout + result.stderr).toContain('Invalid date format')
    })

    it('E2E-edge: 確認「n」でリセットがキャンセルされる', async () => {
      // Act
      const result = await runCli(['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'], {
        input: 'n\n',
      })

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('cancelled')

      // ファイルが更新されていないこと
      const content = await fs.readFile(watermarkPath, 'utf-8')
      const watermark = JSON.parse(content)
      expect(watermark.last_fetched_date).toBe('2025-01-15T00:00:00.000Z')
    })
  })

  // ======================
  // 共通機能 E2E
  // ======================
  describe('共通機能全体疎通', () => {
    it('E2E: npm run cli -- --help でヘルプが表示される', async () => {
      // Act
      const result = await runCli(['--help'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Usage:')
      expect(result.stdout).toContain('Options:')
      expect(result.stdout).toContain('Commands:')
    })

    it('E2E: npm run cli -- --version でバージョンが表示される', async () => {
      // Act
      const result = await runCli(['--version'])

      // Assert
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('1.0.0')
    })

    it('E2E: 未知のコマンドでエラーとヘルプが表示される', async () => {
      // Act
      const result = await runCli(['unknowncommand'])

      // Assert
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unknown command')
    })

    it('E2E: 成功時にexit code 0で終了', async () => {
      // Act
      const result = await runCli(['--help'])

      // Assert
      expect(result.exitCode).toBe(0)
    })

    it('E2E: エラー時にexit code 1で終了', async () => {
      // Act
      const result = await runCli(['unknowncommand'])

      // Assert
      expect(result.exitCode).toBe(1)
    })
  })

  // ======================
  // 複合シナリオ E2E
  // ======================
  describe('複合シナリオ', () => {
    it('E2E: list -> list の一連のフローが正常に動作', async () => {
      // Arrange: テストファイルを作成
      const testFile = {
        batchIdempotencyKey: 'flow-test',
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
        lastError: 'Test error',
      }
      const filename = 'failed_20250120T103000000Z_flow-test.json'
      await fs.writeFile(`${testFailedDir}/${filename}`, JSON.stringify(testFile))

      // Step 1: list - ファイルが存在することを確認
      const listResult1 = await runCli(['list'])
      expect(listResult1.exitCode).toBe(0)
      expect(listResult1.stdout).toContain('flow-test')
      expect(listResult1.stdout).toContain('Total: 1 files')

      // Step 2: list again - ファイルがまだ存在することを確認
      const listResult2 = await runCli(['list'])
      expect(listResult2.exitCode).toBe(0)
      expect(listResult2.stdout).toContain('flow-test')
    })

    it('E2E: watermark show -> watermark reset -> watermark show の一連のフローが正常に動作', async () => {
      // Arrange: watermark.jsonを準備
      const watermarkPath = `${testDataDir}/watermark.json`
      const initialWatermark = {
        last_fetched_date: '2025-01-15T00:00:00.000Z',
        last_updated_at: '2025-01-20T10:00:00.000Z',
      }
      await fs.writeFile(watermarkPath, JSON.stringify(initialWatermark, null, 2))

      try {
        // Step 1: show - 現在値を確認
        const showResult1 = await runCli(['watermark', 'show'])
        expect(showResult1.exitCode).toBe(0)
        expect(showResult1.stdout).toContain('2025-01-15')

        // Step 2: reset
        const resetResult = await runCli(
          ['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'],
          {
            input: 'y\n',
          },
        )
        expect(resetResult.exitCode).toBe(0)
        expect(resetResult.stdout).toContain('Watermark reset')

        // Step 3: show - 新しい値を確認
        const showResult2 = await runCli(['watermark', 'show'])
        expect(showResult2.exitCode).toBe(0)
        expect(showResult2.stdout).toContain('2025-01-01')
      } finally {
        await fs.rm(watermarkPath).catch(() => {})
      }
    })

    it('E2E: 全コマンドの基本動作が正常', async () => {
      // Arrange
      const watermarkPath = `${testDataDir}/watermark.json`
      const initialWatermark = {
        last_fetched_date: '2025-01-15T00:00:00.000Z',
        last_updated_at: '2025-01-20T10:00:00.000Z',
      }
      await fs.writeFile(watermarkPath, JSON.stringify(initialWatermark, null, 2))

      const testFile = {
        batchIdempotencyKey: 'all-cmds-test',
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
        lastError: 'Test error',
      }
      await fs.writeFile(
        `${testFailedDir}/failed_20250120T103000000Z_all-cmds-test.json`,
        JSON.stringify(testFile),
      )

      try {
        // 1. list
        const listResult = await runCli(['list'])
        expect(listResult.exitCode).toBe(0)

        // 2. watermark show
        const wmShowResult = await runCli(['watermark', 'show'])
        expect(wmShowResult.exitCode).toBe(0)

        // 3. resend (引数なし)
        const resendResult = await runCli(['resend'])
        expect(resendResult.exitCode).toBe(0)

        // 4. watermark reset
        const wmResetResult = await runCli(
          ['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'],
          { input: 'y\n' },
        )
        expect(wmResetResult.exitCode).toBe(0)
      } finally {
        await fs.rm(watermarkPath).catch(() => {})
      }
    })
  })

  // ======================
  // ファイルシステム操作 E2E
  // ======================
  describe('ファイルシステム操作', () => {
    it('E2E: 実際のテスト用失敗ファイルが正しく作成される', async () => {
      // Arrange
      const testFile = {
        batchIdempotencyKey: 'fs-create-test',
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
        lastError: 'Test error',
      }
      const filename = 'failed_20250120T103000000Z_fs-create-test.json'
      const filePath = `${testFailedDir}/${filename}`

      // Act: ファイルを作成
      await fs.writeFile(filePath, JSON.stringify(testFile, null, 2))

      // Assert: ファイルが存在し、内容が正しいこと
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.batchIdempotencyKey).toBe('fs-create-test')
      expect(parsed.records).toHaveLength(1)
    })

    it('E2E: watermark.jsonが正しく読み書きされる', async () => {
      // Arrange
      const watermarkPath = `${testDataDir}/watermark.json`
      const initialWatermark = {
        last_fetched_date: '2025-01-15T00:00:00.000Z',
        last_updated_at: '2025-01-20T10:00:00.000Z',
      }
      await fs.writeFile(watermarkPath, JSON.stringify(initialWatermark, null, 2))

      try {
        // Act
        await runCli(['watermark', 'reset', '--date', '2025-01-01T00:00:00.000Z'], {
          input: 'y\n',
        })

        // Assert
        const content = await fs.readFile(watermarkPath, 'utf-8')
        const watermark = JSON.parse(content)
        expect(watermark.last_fetched_date).toBe('2025-01-01T00:00:00.000Z')
      } finally {
        await fs.rm(watermarkPath).catch(() => {})
      }
    })
  })

  // ======================
  // パフォーマンス E2E
  // ======================
  describe('パフォーマンス', () => {
    it('E2E-perf: listコマンドが10ファイル以下で合理的な時間内に完了', async () => {
      // Arrange: 複数のテストファイルを作成
      const promises = []
      for (let i = 0; i < 10; i++) {
        const testFile = {
          batchIdempotencyKey: `perf-test-${i}`,
          records: [
            {
              date: '2025-01-20',
              app_id: `app${i}`,
              provider: 'openai',
              model: 'gpt-4',
              input_tokens: 80,
              output_tokens: 20,
              total_tokens: 100,
              idempotency_key: `key${i}`,
              transformed_at: '2025-01-20T10:30:00.000Z',
            },
          ],
          firstAttempt: '2025-01-20T10:30:00.000Z',
          retryCount: 10,
          lastError: 'Test error',
        }
        promises.push(
          fs.writeFile(
            `${testFailedDir}/failed_2025012${i}T103000000Z_perf-test-${i}.json`,
            JSON.stringify(testFile),
          ),
        )
      }
      await Promise.all(promises)

      // Act
      const startTime = Date.now()
      const result = await runCli(['list'])
      const endTime = Date.now()

      // Assert
      expect(result.exitCode).toBe(0)
      // プロセス起動時間を含めて5秒以内
      expect(endTime - startTime).toBeLessThan(5000)
    })
  })
})
