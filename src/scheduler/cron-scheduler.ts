import { CronJob } from 'cron'
import type { Logger } from '../logger/winston-logger.js'
import type { EnvConfig } from '../types/env.js'

export interface Scheduler {
  start(): void
  stop(): void
  isRunning(): boolean
}

function validateCronExpression(expression: string): boolean {
  try {
    const testJob = CronJob.from({
      cronTime: expression,
      onTick: () => {},
      start: false,
    })
    testJob.stop()
    return true
  } catch {
    return false
  }
}

function generateExecutionId(): string {
  return `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function createScheduler(
  config: EnvConfig,
  logger: Logger,
  onTick: () => Promise<void>,
): Scheduler {
  if (!validateCronExpression(config.CRON_SCHEDULE)) {
    logger.error('無効なcron式です', { cronSchedule: config.CRON_SCHEDULE })
    process.exit(1)
  }

  let isTaskRunning = false

  const job = CronJob.from({
    cronTime: config.CRON_SCHEDULE,
    onTick: async () => {
      if (isTaskRunning) {
        logger.warn('前回のジョブが実行中のためスキップします')
        return
      }

      isTaskRunning = true
      const executionId = generateExecutionId()
      const taskLogger = logger.child({ executionId })

      taskLogger.info('ジョブ実行開始')
      const startTime = Date.now()

      try {
        await onTick()
        const duration = Date.now() - startTime
        taskLogger.info('ジョブ実行完了', { durationMs: duration })
      } catch (error) {
        const duration = Date.now() - startTime
        taskLogger.error('ジョブ実行失敗', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: duration,
        })
      } finally {
        isTaskRunning = false
      }
    },
    start: false,
    timeZone: 'UTC',
  })

  return {
    start: () => {
      job.start()
      const nextDate = job.nextDate()
      logger.info('スケジューラ起動完了', {
        cronSchedule: config.CRON_SCHEDULE,
        nextExecution: nextDate?.toISO(),
      })
    },
    stop: () => {
      job.stop()
      logger.info('スケジューラ停止完了')
    },
    isRunning: () => isTaskRunning,
  }
}
