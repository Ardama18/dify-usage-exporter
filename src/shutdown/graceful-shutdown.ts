import type { Logger } from '../logger/winston-logger.js'
import type { Scheduler } from '../scheduler/cron-scheduler.js'

export interface GracefulShutdownOptions {
  timeoutMs: number
  scheduler: Scheduler
  logger: Logger
  healthCheckServer?: {
    stop: () => Promise<void>
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function setupGracefulShutdown(options: GracefulShutdownOptions): void {
  const { timeoutMs, scheduler, logger, healthCheckServer } = options

  const shutdown = async (signal: string) => {
    logger.info('シャットダウンシグナル受信', { signal })

    // シャットダウン順序:
    // 1. HealthCheckServerを停止（新規リクエストの受付を停止）
    // 2. スケジューラを停止（新規タスクの開始を停止）
    // 3. 実行中のタスクが完了するまで待機

    // 1. HealthCheckServerを停止（最初に実行）
    if (healthCheckServer) {
      try {
        await healthCheckServer.stop()
      } catch (error) {
        logger.error('HealthCheckServer停止エラー', {
          error: error instanceof Error ? error.message : String(error),
        })
        // エラーでも処理を継続
      }
    }

    // 2. スケジューラを停止
    scheduler.stop()

    // 3. 実行中のタスクが完了するまで待機
    const startTime = Date.now()
    while (scheduler.isRunning()) {
      if (Date.now() - startTime > timeoutMs) {
        logger.error('Graceful Shutdownタイムアウト', { timeoutMs })
        process.exit(1)
      }
      await sleep(100)
    }

    logger.info('Graceful Shutdown完了')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // 未処理のPromise rejectionをハンドリング（Fail-Fast原則）
  process.on('unhandledRejection', (reason) => {
    logger.error('未処理のPromise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
    // Fail-Fast: 未処理のrejectionは予期しない状態を示すため即座に終了
    process.exit(1)
  })

  // 未捕捉の例外をハンドリング
  process.on('uncaughtException', (error) => {
    logger.error('未捕捉の例外', {
      error: error.message,
      stack: error.stack,
    })
    process.exit(1)
  })
}
