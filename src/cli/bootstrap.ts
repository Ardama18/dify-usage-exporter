/**
 * CLI依存関係構築
 *
 * CLIコマンド実行に必要な依存関係を構築する。
 */

import { loadConfig } from '../config/env-config.js'
import { createLogger, type Logger } from '../logger/winston-logger.js'
import { ConsoleNotifier } from '../notifier/console-notifier.js'
import { ExternalApiSender } from '../sender/external-api-sender.js'
import { HttpClient } from '../sender/http-client.js'
import { SpoolManager } from '../sender/spool-manager.js'
import type { EnvConfig } from '../types/env.js'
import type { ExecutionMetrics } from '../types/metrics.js'
import { createWatermarkManager, type WatermarkManager } from '../watermark/watermark-manager.js'

/**
 * CLI依存関係インターフェース
 *
 * CLIコマンドで使用する依存関係を定義する。
 */
export interface CliDependencies {
  config: EnvConfig
  logger: Logger
  spoolManager: SpoolManager
  watermarkManager: WatermarkManager
  externalApiSender: ExternalApiSender
}

/**
 * CLI依存関係を構築
 *
 * @returns CLI依存関係オブジェクト
 */
export function bootstrapCli(): CliDependencies {
  // 1. 環境変数読み込み
  const config = loadConfig()

  // 2. ロガー作成
  const logger = createLogger(config)

  // 3. SpoolManager作成
  const spoolManager = new SpoolManager(logger)

  // 4. WatermarkManager作成
  const watermarkManager = createWatermarkManager({ config, logger })

  // 5. HttpClient作成
  const httpClient = new HttpClient(logger, config)

  // 6. Notifier作成（CLIではConsoleNotifier）
  const notifier = new ConsoleNotifier()

  // 7. メトリクス初期化（CLIでは最小限）
  const metrics: ExecutionMetrics = {
    fetchedRecords: 0,
    transformedRecords: 0,
    sendSuccess: 0,
    sendFailed: 0,
    spoolSaved: 0,
    spoolResendSuccess: 0,
    failedMoved: 0,
  }

  // 8. ExternalApiSender作成
  const externalApiSender = new ExternalApiSender(
    httpClient,
    spoolManager,
    notifier,
    logger,
    config,
    metrics,
  )

  return {
    config,
    logger,
    spoolManager,
    watermarkManager,
    externalApiSender,
  }
}
