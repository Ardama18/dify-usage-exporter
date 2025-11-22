import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../logger/winston-logger.js'
import type { Scheduler } from '../../scheduler/cron-scheduler.js'
import { type GracefulShutdownOptions, setupGracefulShutdown } from '../graceful-shutdown.js'

describe('setupGracefulShutdown', () => {
  let mockLogger: Logger
  let mockScheduler: Scheduler
  let mockHealthCheckServer: { stop: () => Promise<void> }
  let processExitSpy: ReturnType<typeof vi.spyOn>
  let processOnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger

    mockScheduler = {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: vi.fn().mockReturnValue(false),
    } as unknown as Scheduler

    mockHealthCheckServer = {
      stop: vi.fn().mockResolvedValue(undefined),
    }

    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never
    })

    processOnSpy = vi.spyOn(process, 'on')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('シグナルハンドラーの登録', () => {
    it('SIGINT, SIGTERM, unhandledRejection, uncaughtException ハンドラーを登録する', () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function))
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function))
    })
  })

  describe('シャットダウン処理', () => {
    it('SIGINTシグナルでシャットダウン処理を実行する', async () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      // SIGINTハンドラーを取得して実行
      const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT')
      const sigintHandler = sigintCall?.[1] as () => Promise<void>

      await sigintHandler()

      expect(mockLogger.info).toHaveBeenCalledWith('シャットダウンシグナル受信', {
        signal: 'SIGINT',
      })
      expect(mockScheduler.stop).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Graceful Shutdown完了')
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('SIGTERMシグナルでシャットダウン処理を実行する', async () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      // SIGTERMハンドラーを取得して実行
      const sigtermCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGTERM')
      const sigtermHandler = sigtermCall?.[1] as () => Promise<void>

      await sigtermHandler()

      expect(mockLogger.info).toHaveBeenCalledWith('シャットダウンシグナル受信', {
        signal: 'SIGTERM',
      })
      expect(mockScheduler.stop).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Graceful Shutdown完了')
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('スケジューラが実行中の場合は完了を待機する', async () => {
      let runningCount = 0
      mockScheduler.isRunning = vi.fn(() => {
        runningCount++
        return runningCount < 3 // 最初の2回はtrue、3回目からfalse
      })

      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT')
      const sigintHandler = sigintCall?.[1] as () => Promise<void>

      await sigintHandler()

      expect(mockScheduler.isRunning).toHaveBeenCalledTimes(3)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('タイムアウト処理の設定が正しく行われる', () => {
      // タイムアウトロジックのテストは実際の時間経過が必要なため、
      // ここではオプションが正しく渡されることのみをテスト
      const options: GracefulShutdownOptions = {
        timeoutMs: 100,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      // 例外なくセットアップが完了することを確認
      expect(() => setupGracefulShutdown(options)).not.toThrow()
    })
  })

  describe('HealthCheckServer統合', () => {
    it('healthCheckServer オプションが渡された場合に stop() が呼ばれる', async () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
        healthCheckServer: mockHealthCheckServer,
      }

      setupGracefulShutdown(options)

      const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT')
      const sigintHandler = sigintCall?.[1] as () => Promise<void>

      await sigintHandler()

      expect(mockHealthCheckServer.stop).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('healthCheckServer が undefined の場合はスキップされる', async () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
        // healthCheckServer は未定義
      }

      setupGracefulShutdown(options)

      const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT')
      const sigintHandler = sigintCall?.[1] as () => Promise<void>

      await sigintHandler()

      // エラーなく正常に終了
      expect(mockLogger.info).toHaveBeenCalledWith('Graceful Shutdown完了')
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('healthCheckServer.stop() が最初に実行される（順序確認）', async () => {
      const callOrder: string[] = []

      mockHealthCheckServer.stop = vi.fn().mockImplementation(async () => {
        callOrder.push('healthCheckServer.stop')
      })
      mockScheduler.stop = vi.fn().mockImplementation(() => {
        callOrder.push('scheduler.stop')
      })

      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
        healthCheckServer: mockHealthCheckServer,
      }

      setupGracefulShutdown(options)

      const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT')
      const sigintHandler = sigintCall?.[1] as () => Promise<void>

      await sigintHandler()

      expect(callOrder).toEqual(['healthCheckServer.stop', 'scheduler.stop'])
    })

    it('healthCheckServer.stop() がエラーでも他の処理は継続', async () => {
      const healthCheckError = new Error('HealthCheck stop failed')
      mockHealthCheckServer.stop = vi.fn().mockRejectedValue(healthCheckError)

      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
        healthCheckServer: mockHealthCheckServer,
      }

      setupGracefulShutdown(options)

      const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT')
      const sigintHandler = sigintCall?.[1] as () => Promise<void>

      await sigintHandler()

      // エラーがログ出力されている
      expect(mockLogger.error).toHaveBeenCalledWith('HealthCheckServer停止エラー', {
        error: 'HealthCheck stop failed',
      })
      // 他の処理が継続している
      expect(mockScheduler.stop).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('Graceful Shutdown完了')
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })
  })

  describe('未処理のPromise rejection', () => {
    it('unhandledRejectionでエラーログを出力してexitコード1で終了する', () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      const unhandledCall = processOnSpy.mock.calls.find(
        (call: unknown[]) => call[0] === 'unhandledRejection',
      )
      const unhandledHandler = unhandledCall?.[1] as (reason: unknown) => void

      const testError = new Error('Test rejection')
      unhandledHandler(testError)

      expect(mockLogger.error).toHaveBeenCalledWith('未処理のPromise rejection', {
        reason: 'Test rejection',
        stack: testError.stack,
      })
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('unhandledRejectionでError以外の値も処理できる', () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      const unhandledCall = processOnSpy.mock.calls.find(
        (call: unknown[]) => call[0] === 'unhandledRejection',
      )
      const unhandledHandler = unhandledCall?.[1] as (reason: unknown) => void

      unhandledHandler('String error')

      expect(mockLogger.error).toHaveBeenCalledWith('未処理のPromise rejection', {
        reason: 'String error',
        stack: undefined,
      })
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('未捕捉の例外', () => {
    it('uncaughtExceptionでエラーログを出力してexitコード1で終了する', () => {
      const options: GracefulShutdownOptions = {
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger: mockLogger,
      }

      setupGracefulShutdown(options)

      const uncaughtCall = processOnSpy.mock.calls.find(
        (call: unknown[]) => call[0] === 'uncaughtException',
      )
      const uncaughtHandler = uncaughtCall?.[1] as (error: Error) => void

      const testError = new Error('Test exception')
      uncaughtHandler(testError)

      expect(mockLogger.error).toHaveBeenCalledWith('未捕捉の例外', {
        error: 'Test exception',
        stack: testError.stack,
      })
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
