import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// loadConfig関数をテストするため、process.envとprocess.exitをモック化
describe('環境変数管理 - loadConfig()', () => {
  const originalEnv = process.env
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called')
  })
  const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    mockExit.mockClear()
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // AC-ENV-1: 起動時の環境変数読み込み（2件）
  describe('AC-ENV-1: 起動時の環境変数読み込み', () => {
    it('正常な環境変数セットでloadConfig()が成功する', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config).toBeDefined()
      expect(config.DIFY_API_BASE_URL).toBe('https://api.dify.ai')
      expect(config.DIFY_API_TOKEN).toBe('dify-token-123')
      expect(config.EXTERNAL_API_URL).toBe('https://external.api.com')
      expect(config.EXTERNAL_API_TOKEN).toBe('external-token-456')
    })

    it('返却値がEnvConfig型に準拠する', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.LOG_LEVEL = 'debug'
      process.env.MAX_RETRY = '5'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert - 全プロパティが存在することを確認
      expect(config).toHaveProperty('DIFY_API_BASE_URL')
      expect(config).toHaveProperty('DIFY_API_TOKEN')
      expect(config).toHaveProperty('EXTERNAL_API_URL')
      expect(config).toHaveProperty('EXTERNAL_API_TOKEN')
      expect(config).toHaveProperty('CRON_SCHEDULE')
      expect(config).toHaveProperty('LOG_LEVEL')
      expect(config).toHaveProperty('GRACEFUL_SHUTDOWN_TIMEOUT')
      expect(config).toHaveProperty('MAX_RETRY')
      expect(config).toHaveProperty('NODE_ENV')
      expect(config.LOG_LEVEL).toBe('debug')
      expect(config.MAX_RETRY).toBe(5)
    })
  })

  // AC-ENV-2: 必須環境変数未設定時のエラー処理（5件）
  describe('AC-ENV-2: 必須環境変数未設定時のエラー処理', () => {
    it('DIFY_API_BASE_URL未設定でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      // DIFY_API_BASE_URLは未設定

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('DIFY_API_TOKEN未設定でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      // DIFY_API_TOKENは未設定

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('EXTERNAL_API_URL未設定でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      // EXTERNAL_API_URLは未設定

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('EXTERNAL_API_TOKEN未設定でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      // EXTERNAL_API_TOKENは未設定

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('複数の必須環境変数未設定でエラーメッセージが出力される', async () => {
      // Arrange - 全ての必須環境変数を未設定

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockConsoleError).toHaveBeenCalledWith('環境変数の検証に失敗しました:')
    })
  })

  // AC-ENV-3: 不正値時のZodエラー処理（8件）
  describe('AC-ENV-3: 不正値時のZodエラー処理', () => {
    it('DIFY_API_BASE_URLが不正なURL形式でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'not-a-valid-url'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('EXTERNAL_API_URLが不正なURL形式でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'invalid-url'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('LOG_LEVELが無効な値でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.LOG_LEVEL = 'invalid'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('GRACEFUL_SHUTDOWN_TIMEOUTが数値でない場合exit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.GRACEFUL_SHUTDOWN_TIMEOUT = 'not-a-number'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('GRACEFUL_SHUTDOWN_TIMEOUTが1未満でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.GRACEFUL_SHUTDOWN_TIMEOUT = '0'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('GRACEFUL_SHUTDOWN_TIMEOUTが300超過でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.GRACEFUL_SHUTDOWN_TIMEOUT = '301'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('MAX_RETRYが1未満でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.MAX_RETRY = '0'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('MAX_RETRYが10超過でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.MAX_RETRY = '11'

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  // AC-ENV-4: オプション環境変数のデフォルト値（5件）
  describe('AC-ENV-4: オプション環境変数のデフォルト値', () => {
    beforeEach(() => {
      // 全テストで必須環境変数を設定
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
    })

    it('CRON_SCHEDULEのデフォルト値は"0 0 * * *"である', async () => {
      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config.CRON_SCHEDULE).toBe('0 0 * * *')
    })

    it('LOG_LEVELのデフォルト値は"info"である', async () => {
      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config.LOG_LEVEL).toBe('info')
    })

    it('GRACEFUL_SHUTDOWN_TIMEOUTのデフォルト値は30である', async () => {
      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config.GRACEFUL_SHUTDOWN_TIMEOUT).toBe(30)
    })

    it('MAX_RETRYのデフォルト値は3である', async () => {
      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config.MAX_RETRY).toBe(3)
    })

    it('NODE_ENVのデフォルト値は"production"である', async () => {
      // Arrange - NODE_ENVを削除してデフォルト値をテスト
      delete process.env.NODE_ENV

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config.NODE_ENV).toBe('production')
    })
  })

  // AC-ENV-5: loadConfig()経由の設定取得（2件）
  describe('AC-ENV-5: loadConfig()経由の設定取得', () => {
    it('process.envを直接参照せずloadConfig()経由で取得する', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.LOG_LEVEL = 'debug'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert - loadConfigから型安全な値が取得できる
      expect(typeof config.LOG_LEVEL).toBe('string')
      expect(config.LOG_LEVEL).toBe('debug')
      // process.envの値は文字列だが、loadConfigは適切な型に変換する
      expect(typeof config.GRACEFUL_SHUTDOWN_TIMEOUT).toBe('number')
      expect(typeof config.MAX_RETRY).toBe('number')
    })

    it('複数回呼び出しても同一設定を返却する', async () => {
      // Arrange
      process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config1 = loadConfig()
      const config2 = loadConfig()

      // Assert
      expect(config1).toEqual(config2)
      expect(config1.DIFY_API_BASE_URL).toBe(config2.DIFY_API_BASE_URL)
      expect(config1.CRON_SCHEDULE).toBe(config2.CRON_SCHEDULE)
    })
  })
})

import { Writable } from 'node:stream'

// ログ出力をキャプチャするためのカスタムWritableストリーム
function createCaptureStream(output: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString())
      callback()
    },
  })
}

// ログ出力基盤のテスト - createLogger関数をテストするため、カスタムストリームを使用
describe('ログ出力基盤 - createLogger()', () => {
  const originalEnv = process.env
  let capturedOutput: string[]
  let captureStream: Writable

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // 必須環境変数を設定
    process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
    process.env.DIFY_API_TOKEN = 'dify-token-123'
    process.env.EXTERNAL_API_URL = 'https://external.api.com'
    process.env.EXTERNAL_API_TOKEN = 'external-token-456'
    process.env.NODE_ENV = 'test'

    // カスタムストリームでログ出力をキャプチャ
    capturedOutput = []
    captureStream = createCaptureStream(capturedOutput)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // AC-LOG-1: JSON Lines形式での標準出力（4件）
  describe('AC-LOG-1: JSON Lines形式での標準出力', () => {
    it('ログ出力がJSON形式である', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      expect(capturedOutput.length).toBeGreaterThan(0)
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed).toBeDefined()
    })

    it('各ログが1行で出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      const lines = capturedOutput[0].split('\n').filter((line) => line.trim() !== '')
      expect(lines.length).toBe(1)
    })

    it('複数ログが改行区切りで出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('メッセージ1')
      logger.info('メッセージ2')

      // Assert
      expect(capturedOutput.length).toBe(2)
      // 各出力が改行で終わる
      expect(capturedOutput[0].endsWith('\n')).toBe(true)
      expect(capturedOutput[1].endsWith('\n')).toBe(true)
    })

    it('JSON.parse()で正常にパース可能である', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      expect(() => JSON.parse(capturedOutput[0])).not.toThrow()
    })
  })

  // AC-LOG-2: ログフィールドの含有（5件）
  describe('AC-LOG-2: ログフィールドの含有', () => {
    it('timestampフィールドがISO 8601形式で含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.timestamp).toBeDefined()
      // ISO 8601形式: YYYY-MM-DDTHH:mm:ss.SSSZ
      expect(parsed.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
      )
    })

    it('levelフィールドが含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.level).toBe('info')
    })

    it('messageフィールドが含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.message).toBe('テストメッセージ')
    })

    it('serviceフィールドが含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.service).toBe('dify-usage-exporter')
    })

    it('envフィールドが含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('テストメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.env).toBe('test')
    })
  })

  // AC-LOG-3: 4つのログレベルサポート（7件）
  describe('AC-LOG-3: 4つのログレベルサポート', () => {
    it('errorレベルが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.error('エラーメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.level).toBe('error')
      expect(parsed.message).toBe('エラーメッセージ')
    })

    it('warnレベルが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.warn('警告メッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.level).toBe('warn')
      expect(parsed.message).toBe('警告メッセージ')
    })

    it('infoレベルが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.info('情報メッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.level).toBe('info')
      expect(parsed.message).toBe('情報メッセージ')
    })

    it('debugレベルが出力される', async () => {
      // Arrange
      process.env.LOG_LEVEL = 'debug'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.debug('デバッグメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.level).toBe('debug')
      expect(parsed.message).toBe('デバッグメッセージ')
    })

    it('LOG_LEVEL=errorでdebugが出力されない', async () => {
      // Arrange
      process.env.LOG_LEVEL = 'error'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.debug('デバッグメッセージ')

      // Assert
      expect(capturedOutput.length).toBe(0)
    })

    it('LOG_LEVEL=infoでdebugが出力されない', async () => {
      // Arrange
      process.env.LOG_LEVEL = 'info'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.debug('デバッグメッセージ')

      // Assert
      expect(capturedOutput.length).toBe(0)
    })

    it('LOG_LEVEL=debugで全レベルが出力される', async () => {
      // Arrange
      process.env.LOG_LEVEL = 'debug'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      logger.error('エラー')
      logger.warn('警告')
      logger.info('情報')
      logger.debug('デバッグ')

      // Assert
      expect(capturedOutput.length).toBe(4)
      expect(JSON.parse(capturedOutput[0]).level).toBe('error')
      expect(JSON.parse(capturedOutput[1]).level).toBe('warn')
      expect(JSON.parse(capturedOutput[2]).level).toBe('info')
      expect(JSON.parse(capturedOutput[3]).level).toBe('debug')
    })
  })

  // AC-LOG-4: エラーログのスタックトレース（3件）
  describe('AC-LOG-4: エラーログのスタックトレース', () => {
    it('Errorオブジェクト渡しでスタックトレースが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const error = new Error('テストエラー')

      // Act
      logger.error('エラー発生', { error })

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.error).toBeDefined()
    })

    it('スタックトレースがstackフィールドに含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const error = new Error('テストエラー')

      // Act
      logger.error('エラー発生', { stack: error.stack })

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.stack).toBeDefined()
      expect(parsed.stack).toContain('Error: テストエラー')
    })

    it('エラーメッセージがフィールドに含まれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const error = new Error('テストエラー')

      // Act
      logger.error('エラー発生', { errorMessage: error.message })

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.errorMessage).toBe('テストエラー')
    })
  })

  // AC-LOG-5: シークレット情報の非出力（3件）
  describe('AC-LOG-5: シークレット情報の非出力', () => {
    it('DIFY_API_TOKENがログに含まれない（呼び出し側の責務）', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act - 意図的にトークンを含めない（呼び出し側の責務）
      logger.info('設定値', {
        difyApiUrl: config.DIFY_API_BASE_URL,
        // DIFY_API_TOKENは渡さない
      })

      // Assert
      const output = capturedOutput[0]
      expect(output).not.toContain('dify-token-123')
    })

    it('EXTERNAL_API_TOKENがログに含まれない（呼び出し側の責務）', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act - 意図的にトークンを含めない（呼び出し側の責務）
      logger.info('設定値', {
        externalApiUrl: config.EXTERNAL_API_URL,
        // EXTERNAL_API_TOKENは渡さない
      })

      // Assert
      const output = capturedOutput[0]
      expect(output).not.toContain('external-token-456')
    })

    it('意図的にシークレットを渡した場合でもログに含まれる（フィルタリングなし）', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act - 注意事項に記載の通り、ログ関数はフィルタリングしない
      // これは「呼び出し側でシークレットを渡さない」責務を示すテスト
      logger.info('危険な使い方', {
        token: config.DIFY_API_TOKEN,
      })

      // Assert - フィルタリングしないので出力される（これは警告目的のテスト）
      const output = capturedOutput[0]
      expect(output).toContain('dify-token-123')
    })
  })

  // Logger子インスタンス（2件）
  describe('Logger子インスタンス', () => {
    it('child()で子ロガーが作成できる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      const childLogger = logger.child({ requestId: 'req-123' })
      childLogger.info('子ロガーからのメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.message).toBe('子ロガーからのメッセージ')
    })

    it('子ロガーがメタデータを継承する', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // Act
      const childLogger = logger.child({ requestId: 'req-123', userId: 'user-456' })
      childLogger.info('メタデータ付きメッセージ')

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.requestId).toBe('req-123')
      expect(parsed.userId).toBe('user-456')
      // 親のdefaultMeta（service, env）も継承される
      expect(parsed.service).toBe('dify-usage-exporter')
      expect(parsed.env).toBe('test')
    })
  })
})

// 定期実行スケジューラのテスト - createScheduler関数をテスト
describe('定期実行スケジューラ - createScheduler()', () => {
  const originalEnv = process.env
  let capturedOutput: string[]
  let captureStream: Writable
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called')
  })

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // 必須環境変数を設定
    process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
    process.env.DIFY_API_TOKEN = 'dify-token-123'
    process.env.EXTERNAL_API_URL = 'https://external.api.com'
    process.env.EXTERNAL_API_TOKEN = 'external-token-456'
    process.env.NODE_ENV = 'test'
    process.env.CRON_SCHEDULE = '* * * * * *' // 毎秒実行（テスト用）

    // カスタムストリームでログ出力をキャプチャ
    capturedOutput = []
    captureStream = createCaptureStream(capturedOutput)
    mockExit.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ジョブ実行を待機するヘルパー関数
  const waitForJobExecution = (timeout = 2000): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, timeout))
  }

  // AC-SCHED-1: スケジューラ起動と次回実行予定ログ（3件）
  describe('AC-SCHED-1: スケジューラ起動と次回実行予定ログ', () => {
    it('start()呼び出しで起動ログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()

      // Assert
      expect(capturedOutput.length).toBeGreaterThan(0)
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.message).toBe('スケジューラ起動完了')

      // Cleanup
      scheduler.stop()
    })

    it('起動ログにcronScheduleを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.cronSchedule).toBe('* * * * * *') // 毎秒実行（テスト用）

      // Cleanup
      scheduler.stop()
    })

    it('起動ログにnextExecutionを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.nextExecution).toBeDefined()

      // Cleanup
      scheduler.stop()
    })
  })

  // AC-SCHED-2: cron時刻到達時のonTick実行（4件）
  describe('AC-SCHED-2: cron時刻到達時のonTick実行', () => {
    it('cron時刻到達でonTick関数が実行される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      expect(onTick).toHaveBeenCalled()

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('ジョブ実行開始ログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const startLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行開始'
      })
      expect(startLog).toBeDefined()

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('ジョブ実行完了ログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const completeLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行完了'
      })
      expect(completeLog).toBeDefined()

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('完了ログにdurationMsを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const completeLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行完了'
      })
      expect(completeLog).toBeDefined()
      const parsed = JSON.parse(completeLog as string)
      expect(parsed.durationMs).toBeDefined()
      expect(typeof parsed.durationMs).toBe('number')

      // Cleanup
      scheduler.stop()
    }, 5000)
  })

  // AC-SCHED-3: CRON_SCHEDULE環境変数の使用（2件）
  describe('AC-SCHED-3: CRON_SCHEDULE環境変数の使用', () => {
    it('環境変数の値をcron式として使用する', async () => {
      // Arrange
      process.env.CRON_SCHEDULE = '0 12 * * *' // 毎日12時
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.cronSchedule).toBe('0 12 * * *')

      // Cleanup
      scheduler.stop()
    })

    it('デフォルト値（0 0 * * *）が使用される', async () => {
      // Arrange
      delete process.env.CRON_SCHEDULE
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()

      // Assert
      const parsed = JSON.parse(capturedOutput[0])
      expect(parsed.cronSchedule).toBe('0 0 * * *')

      // Cleanup
      scheduler.stop()
    })
  })

  // AC-SCHED-4: 無効なcron式でのexit（3件）
  describe('AC-SCHED-4: 無効なcron式でのexit', () => {
    it('無効なcron式でエラーログが出力される', async () => {
      // Arrange
      process.env.CRON_SCHEDULE = 'invalid-cron'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)

      // Act & Assert
      expect(() => createScheduler(config, logger, onTick)).toThrow('process.exit called')

      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'error'
      })
      expect(errorLog).toBeDefined()
    })

    it('無効なcron式でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.CRON_SCHEDULE = 'invalid-cron'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)

      // Act & Assert
      expect(() => createScheduler(config, logger, onTick)).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('エラーログにcronScheduleを含む', async () => {
      // Arrange
      process.env.CRON_SCHEDULE = 'invalid-cron'
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)

      // Act
      try {
        createScheduler(config, logger, onTick)
      } catch {
        // expected
      }

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'error'
      })
      expect(errorLog).toBeDefined()
      const parsed = JSON.parse(errorLog as string)
      expect(parsed.cronSchedule).toBe('invalid-cron')
    })
  })

  // AC-SCHED-5: 実行中ジョブのスキップ（3件）
  describe('AC-SCHED-5: 実行中ジョブのスキップ', () => {
    it('実行中に新しいジョブがスキップされる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // 長時間実行されるジョブ（3秒かかる）
      let resolveJob: () => void
      const jobPromise = new Promise<void>((resolve) => {
        resolveJob = resolve
      })
      const onTick = vi.fn().mockImplementation(() => jobPromise)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      // 最初のジョブが開始されるまで待機
      await waitForJobExecution()
      // 2回目のcron時刻（ジョブ実行中）を待機
      await waitForJobExecution(1500)

      // Assert - onTickは1回のみ呼ばれる
      expect(onTick).toHaveBeenCalledTimes(1)

      // Cleanup
      resolveJob?.()
      await jobPromise
      scheduler.stop()
    }, 10000)

    it('スキップ時にwarningログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      let resolveJob: () => void
      const jobPromise = new Promise<void>((resolve) => {
        resolveJob = resolve
      })
      const onTick = vi.fn().mockImplementation(() => jobPromise)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()
      await waitForJobExecution(1500)

      // Assert
      const warnLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'warn' && parsed.message.includes('スキップ')
      })
      expect(warnLog).toBeDefined()

      // Cleanup
      resolveJob?.()
      await jobPromise
      scheduler.stop()
    }, 10000)

    it('前回ジョブ完了後は次回ジョブが実行される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      // 2回のジョブ実行を待機
      await waitForJobExecution(3000)

      // Assert - 毎秒実行なので2回以上実行される
      expect(onTick.mock.calls.length).toBeGreaterThanOrEqual(2)

      // Cleanup
      scheduler.stop()
    }, 10000)
  })

  // AC-SCHED-6: executionId生成とログ含有（4件）
  describe('AC-SCHED-6: executionId生成とログ含有', () => {
    it('各ジョブに一意のexecutionIdが生成される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      // 複数回のジョブ実行を待機
      await waitForJobExecution(3000)

      // Assert
      const startLogs = capturedOutput.filter((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行開始'
      })
      expect(startLogs.length).toBeGreaterThanOrEqual(2)

      const executionIds = startLogs.map((log) => JSON.parse(log).executionId)
      // 最初の2つのIDが異なることを確認
      expect(executionIds[0]).not.toBe(executionIds[1])

      // Cleanup
      scheduler.stop()
    }, 10000)

    it('開始ログにexecutionIdを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const startLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行開始'
      })
      expect(startLog).toBeDefined()
      const parsed = JSON.parse(startLog as string)
      expect(parsed.executionId).toBeDefined()
      expect(parsed.executionId).toMatch(/^exec-\d+-[a-z0-9]+$/)

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('完了ログにexecutionIdを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const completeLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行完了'
      })
      expect(completeLog).toBeDefined()
      const parsed = JSON.parse(completeLog as string)
      expect(parsed.executionId).toBeDefined()

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('失敗ログにexecutionIdを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockRejectedValue(new Error('テストエラー'))
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行失敗'
      })
      expect(errorLog).toBeDefined()
      const parsed = JSON.parse(errorLog as string)
      expect(parsed.executionId).toBeDefined()

      // Cleanup
      scheduler.stop()
    }, 5000)
  })

  // AC-SCHED-7: cron時刻からの実行精度（1件）
  describe('AC-SCHED-7: cron時刻からの実行精度', () => {
    it('cron時刻から±5秒以内でジョブ実行開始する', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      let executionTime: number | undefined
      const onTick = vi.fn().mockImplementation(() => {
        executionTime = Date.now()
        return Promise.resolve()
      })
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      const startTime = Date.now()
      await waitForJobExecution()

      // Assert
      expect(onTick).toHaveBeenCalled()
      expect(executionTime).toBeDefined()
      // 毎秒実行なので、開始から2秒以内に実行される
      const timeDiff = (executionTime ?? 0) - startTime
      expect(timeDiff).toBeLessThan(5000) // 5秒以内

      // Cleanup
      scheduler.stop()
    }, 5000)
  })

  // スケジューラ停止（2件）
  describe('スケジューラ停止', () => {
    it('stop()呼び出しで停止ログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      scheduler.stop()

      // Assert
      const stopLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'スケジューラ停止完了'
      })
      expect(stopLog).toBeDefined()
    })

    it('停止後はジョブが実行されない', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      scheduler.stop()
      await waitForJobExecution()

      // Assert
      expect(onTick).not.toHaveBeenCalled()
    }, 5000)
  })

  // ジョブ実行エラーハンドリング（4件）
  describe('ジョブ実行エラーハンドリング', () => {
    it('onTickでエラー発生時にエラーログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockRejectedValue(new Error('テストエラー'))
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'error' && parsed.message === 'ジョブ実行失敗'
      })
      expect(errorLog).toBeDefined()

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('エラーログにerrorメッセージを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockRejectedValue(new Error('テストエラー'))
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行失敗'
      })
      expect(errorLog).toBeDefined()
      const parsed = JSON.parse(errorLog as string)
      expect(parsed.error).toBe('テストエラー')

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('エラーログにstackを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockRejectedValue(new Error('テストエラー'))
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'ジョブ実行失敗'
      })
      expect(errorLog).toBeDefined()
      const parsed = JSON.parse(errorLog as string)
      expect(parsed.stack).toBeDefined()
      expect(parsed.stack).toContain('Error: テストエラー')

      // Cleanup
      scheduler.stop()
    }, 5000)

    it('エラー後も次回ジョブは実行される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi
        .fn()
        .mockRejectedValueOnce(new Error('1回目エラー'))
        .mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      // 複数回のジョブ実行を待機
      await waitForJobExecution(3000)

      // Assert - 毎秒実行なので2回以上実行される
      expect(onTick.mock.calls.length).toBeGreaterThanOrEqual(2)

      // Cleanup
      scheduler.stop()
    }, 10000)
  })

  // isRunning()状態確認（2件）
  describe('isRunning()状態確認', () => {
    it('ジョブ実行中はisRunning()がtrueを返す', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      let resolveJob: () => void
      const jobPromise = new Promise<void>((resolve) => {
        resolveJob = resolve
      })
      const onTick = vi.fn().mockImplementation(() => jobPromise)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      expect(scheduler.isRunning()).toBe(true)

      // Cleanup
      resolveJob?.()
      await jobPromise
      scheduler.stop()
    }, 5000)

    it('ジョブ完了後はisRunning()がfalseを返す', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { createScheduler } = await import('../../src/scheduler/cron-scheduler.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })
      const onTick = vi.fn().mockResolvedValue(undefined)
      const scheduler = createScheduler(config, logger, onTick)

      // Act
      scheduler.start()
      await waitForJobExecution()

      // Assert
      expect(scheduler.isRunning()).toBe(false)

      // Cleanup
      scheduler.stop()
    }, 5000)
  })
})

// Graceful Shutdownのテスト - setupGracefulShutdown関数をテスト
describe('Graceful Shutdown - setupGracefulShutdown()', () => {
  const originalEnv = process.env
  let capturedOutput: string[]
  let captureStream: Writable
  let mockExit: ReturnType<typeof vi.spyOn>
  let mockProcessOn: ReturnType<typeof vi.spyOn>
  let signalHandlers: Map<string, (...args: unknown[]) => void>

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // 必須環境変数を設定
    process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
    process.env.DIFY_API_TOKEN = 'dify-token-123'
    process.env.EXTERNAL_API_URL = 'https://external.api.com'
    process.env.EXTERNAL_API_TOKEN = 'external-token-456'
    process.env.NODE_ENV = 'test'

    // カスタムストリームでログ出力をキャプチャ
    capturedOutput = []
    captureStream = createCaptureStream(capturedOutput)

    // シグナルハンドラを保存するMap
    signalHandlers = new Map()

    // process.exit()をモック
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    // process.on()をモックしてシグナルハンドラをキャプチャ
    mockProcessOn = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
      signalHandlers.set(event as string, handler as (...args: unknown[]) => void)
      return process
    })
  })

  afterEach(() => {
    process.env = originalEnv
    mockExit.mockRestore()
    mockProcessOn.mockRestore()
  })

  // AC-SHUT-1: SIGINTによるShutdown開始（2件）
  describe('AC-SHUT-1: SIGINTによるShutdown開始', () => {
    it('SIGINT受信でシャットダウンログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      // SIGINTハンドラを実行
      const handler = signalHandlers.get('SIGINT')
      expect(handler).toBeDefined()

      try {
        await handler?.()
      } catch {
        // exit呼び出しでエラーが発生するのは想定通り
      }

      // Assert
      const shutdownLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'シャットダウンシグナル受信'
      })
      expect(shutdownLog).toBeDefined()
    })

    it('ログにsignal: "SIGINT"を含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGINT')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      const shutdownLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'シャットダウンシグナル受信'
      })
      expect(shutdownLog).toBeDefined()
      const parsed = JSON.parse(shutdownLog as string)
      expect(parsed.signal).toBe('SIGINT')
    })
  })

  // AC-SHUT-2: SIGTERMによるShutdown開始（2件）
  describe('AC-SHUT-2: SIGTERMによるShutdown開始', () => {
    it('SIGTERM受信でシャットダウンログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      expect(handler).toBeDefined()

      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      const shutdownLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'シャットダウンシグナル受信'
      })
      expect(shutdownLog).toBeDefined()
    })

    it('ログにsignal: "SIGTERM"を含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      const shutdownLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'シャットダウンシグナル受信'
      })
      expect(shutdownLog).toBeDefined()
      const parsed = JSON.parse(shutdownLog as string)
      expect(parsed.signal).toBe('SIGTERM')
    })
  })

  // AC-SHUT-3: タスクなしでの即座終了（2件）
  describe('AC-SHUT-3: タスクなしでの即座終了', () => {
    it('isRunning()がfalseの場合即座にexit(0)が呼ばれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('完了ログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      const completeLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'Graceful Shutdown完了'
      })
      expect(completeLog).toBeDefined()
    })
  })

  // AC-SHUT-4: 実行中タスクの完了待機（2件）
  describe('AC-SHUT-4: 実行中タスクの完了待機', () => {
    it('isRunning()がtrueの間待機する', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // isRunning()が2回目の呼び出しでfalseを返す
      let callCount = 0
      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockImplementation(() => {
          callCount++
          return callCount <= 2 // 最初の2回はtrue
        }),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert - isRunning()が複数回呼ばれることを確認
      expect(mockScheduler.isRunning).toHaveBeenCalledTimes(3)
    })

    it('タスク完了後にexit(0)が呼ばれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      let callCount = 0
      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockImplementation(() => {
          callCount++
          return callCount <= 1
        }),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 5000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      expect(mockExit).toHaveBeenCalledWith(0)
    })
  })

  // AC-SHUT-5: タイムアウト超過による強制終了（3件）
  describe('AC-SHUT-5: タイムアウト超過による強制終了', () => {
    it('タイムアウト超過でエラーログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      // isRunning()が常にtrueを返す（タイムアウトさせる）
      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 200, // 短いタイムアウト
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      const timeoutLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'error' && parsed.message === 'Graceful Shutdownタイムアウト'
      })
      expect(timeoutLog).toBeDefined()
    }, 10000)

    it('エラーログにtimeoutMsを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 200,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      const timeoutLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === 'Graceful Shutdownタイムアウト'
      })
      expect(timeoutLog).toBeDefined()
      const parsed = JSON.parse(timeoutLog as string)
      expect(parsed.timeoutMs).toBe(200)
    }, 10000)

    it('exit(1)で終了する', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(true),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 200,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      expect(mockExit).toHaveBeenCalledWith(1)
    }, 10000)
  })

  // AC-SHUT-6: unhandledRejectionでのexit（3件）
  describe('AC-SHUT-6: unhandledRejectionでのexit', () => {
    it('unhandledRejection発生でエラーログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('unhandledRejection')
      expect(handler).toBeDefined()

      try {
        handler?.(new Error('Unhandled rejection error'), Promise.resolve())
      } catch {
        // expected
      }

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'error' && parsed.message === '未処理のPromise rejection'
      })
      expect(errorLog).toBeDefined()
    })

    it('エラーログにreasonを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('unhandledRejection')
      try {
        handler?.(new Error('Unhandled rejection error'), Promise.resolve())
      } catch {
        // expected
      }

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === '未処理のPromise rejection'
      })
      expect(errorLog).toBeDefined()
      const parsed = JSON.parse(errorLog as string)
      expect(parsed.reason).toBe('Unhandled rejection error')
    })

    it('exit(1)で終了する（Fail-Fast原則）', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('unhandledRejection')
      try {
        handler?.(new Error('Unhandled rejection error'), Promise.resolve())
      } catch {
        // expected
      }

      // Assert
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  // AC-SHUT-7: uncaughtExceptionでのexit（3件）
  describe('AC-SHUT-7: uncaughtExceptionでのexit', () => {
    it('uncaughtException発生でエラーログが出力される', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('uncaughtException')
      expect(handler).toBeDefined()

      try {
        handler?.(new Error('Uncaught exception error'))
      } catch {
        // expected
      }

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.level === 'error' && parsed.message === '未捕捉の例外'
      })
      expect(errorLog).toBeDefined()
    })

    it('エラーログにerror/stackを含む', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('uncaughtException')
      try {
        handler?.(new Error('Uncaught exception error'))
      } catch {
        // expected
      }

      // Assert
      const errorLog = capturedOutput.find((output) => {
        const parsed = JSON.parse(output)
        return parsed.message === '未捕捉の例外'
      })
      expect(errorLog).toBeDefined()
      const parsed = JSON.parse(errorLog as string)
      expect(parsed.error).toBe('Uncaught exception error')
      expect(parsed.stack).toBeDefined()
    })

    it('exit(1)で終了する', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('uncaughtException')
      try {
        handler?.(new Error('Uncaught exception error'))
      } catch {
        // expected
      }

      // Assert
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  // スケジューラ停止の確認（1件）
  describe('スケジューラ停止の確認', () => {
    it('シャットダウン時にscheduler.stop()が呼ばれる', async () => {
      // Arrange
      const { loadConfig } = await import('../../src/config/env-config.js')
      const { createLogger } = await import('../../src/logger/winston-logger.js')
      const { setupGracefulShutdown } = await import('../../src/shutdown/graceful-shutdown.js')
      const config = loadConfig()
      const logger = createLogger(config, { stream: captureStream })

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      // Act
      setupGracefulShutdown({
        timeoutMs: 1000,
        scheduler: mockScheduler,
        logger,
      })

      const handler = signalHandlers.get('SIGTERM')
      try {
        await handler?.()
      } catch {
        // expected
      }

      // Assert
      expect(mockScheduler.stop).toHaveBeenCalled()
    })
  })
})

// エントリーポイントのテスト - main()関数をテスト
describe('エントリーポイント - main()', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // 必須環境変数を設定
    process.env.DIFY_API_BASE_URL = 'https://api.dify.ai'
    process.env.DIFY_API_TOKEN = 'dify-token-123'
    process.env.EXTERNAL_API_URL = 'https://external.api.com'
    process.env.EXTERNAL_API_TOKEN = 'external-token-456'
    process.env.NODE_ENV = 'test'
    process.env.CRON_SCHEDULE = '0 0 * * *'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  // 正常起動フロー（4件）
  describe('正常起動フロー', () => {
    it('loadConfig()が呼ばれる', async () => {
      // Arrange
      const mockLoadConfig = vi.fn().mockReturnValue({
        DIFY_API_BASE_URL: 'https://api.dify.ai',
        DIFY_API_TOKEN: 'dify-token-123',
        EXTERNAL_API_URL: 'https://external.api.com',
        EXTERNAL_API_TOKEN: 'external-token-456',
        CRON_SCHEDULE: '0 0 * * *',
        LOG_LEVEL: 'info',
        GRACEFUL_SHUTDOWN_TIMEOUT: 30,
        MAX_RETRY: 3,
        NODE_ENV: 'test',
      })

      vi.doMock('../../src/config/env-config.js', () => ({
        loadConfig: mockLoadConfig,
      }))

      vi.doMock('../../src/logger/winston-logger.js', () => ({
        createLogger: vi.fn().mockReturnValue({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          child: vi.fn().mockReturnValue({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          }),
        }),
      }))

      vi.doMock('../../src/scheduler/cron-scheduler.js', () => ({
        createScheduler: vi.fn().mockReturnValue({
          start: vi.fn(),
          stop: vi.fn(),
          isRunning: vi.fn().mockReturnValue(false),
        }),
      }))

      vi.doMock('../../src/shutdown/graceful-shutdown.js', () => ({
        setupGracefulShutdown: vi.fn(),
      }))

      // Act
      const { main } = await import('../../src/index.js')
      await main()

      // Assert
      expect(mockLoadConfig).toHaveBeenCalled()
    })

    it('createLogger()が呼ばれる', async () => {
      // Arrange
      const mockConfig = {
        DIFY_API_BASE_URL: 'https://api.dify.ai',
        DIFY_API_TOKEN: 'dify-token-123',
        EXTERNAL_API_URL: 'https://external.api.com',
        EXTERNAL_API_TOKEN: 'external-token-456',
        CRON_SCHEDULE: '0 0 * * *',
        LOG_LEVEL: 'info',
        GRACEFUL_SHUTDOWN_TIMEOUT: 30,
        MAX_RETRY: 3,
        NODE_ENV: 'test',
      }

      vi.doMock('../../src/config/env-config.js', () => ({
        loadConfig: vi.fn().mockReturnValue(mockConfig),
      }))

      const mockCreateLogger = vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnValue({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        }),
      })

      vi.doMock('../../src/logger/winston-logger.js', () => ({
        createLogger: mockCreateLogger,
      }))

      vi.doMock('../../src/scheduler/cron-scheduler.js', () => ({
        createScheduler: vi.fn().mockReturnValue({
          start: vi.fn(),
          stop: vi.fn(),
          isRunning: vi.fn().mockReturnValue(false),
        }),
      }))

      vi.doMock('../../src/shutdown/graceful-shutdown.js', () => ({
        setupGracefulShutdown: vi.fn(),
      }))

      // Act
      const { main } = await import('../../src/index.js')
      await main()

      // Assert
      expect(mockCreateLogger).toHaveBeenCalledWith(mockConfig)
    })

    it('createScheduler()が呼ばれる', async () => {
      // Arrange
      const mockConfig = {
        DIFY_API_BASE_URL: 'https://api.dify.ai',
        DIFY_API_TOKEN: 'dify-token-123',
        EXTERNAL_API_URL: 'https://external.api.com',
        EXTERNAL_API_TOKEN: 'external-token-456',
        CRON_SCHEDULE: '0 0 * * *',
        LOG_LEVEL: 'info',
        GRACEFUL_SHUTDOWN_TIMEOUT: 30,
        MAX_RETRY: 3,
        NODE_ENV: 'test',
      }

      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnValue({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        }),
      }

      vi.doMock('../../src/config/env-config.js', () => ({
        loadConfig: vi.fn().mockReturnValue(mockConfig),
      }))

      vi.doMock('../../src/logger/winston-logger.js', () => ({
        createLogger: vi.fn().mockReturnValue(mockLogger),
      }))

      const mockCreateScheduler = vi.fn().mockReturnValue({
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      })

      vi.doMock('../../src/scheduler/cron-scheduler.js', () => ({
        createScheduler: mockCreateScheduler,
      }))

      vi.doMock('../../src/shutdown/graceful-shutdown.js', () => ({
        setupGracefulShutdown: vi.fn(),
      }))

      // Act
      const { main } = await import('../../src/index.js')
      await main()

      // Assert
      expect(mockCreateScheduler).toHaveBeenCalledWith(mockConfig, mockLogger, expect.any(Function))
    })

    it('setupGracefulShutdown()が呼ばれる', async () => {
      // Arrange
      const mockConfig = {
        DIFY_API_BASE_URL: 'https://api.dify.ai',
        DIFY_API_TOKEN: 'dify-token-123',
        EXTERNAL_API_URL: 'https://external.api.com',
        EXTERNAL_API_TOKEN: 'external-token-456',
        CRON_SCHEDULE: '0 0 * * *',
        LOG_LEVEL: 'info',
        GRACEFUL_SHUTDOWN_TIMEOUT: 30,
        MAX_RETRY: 3,
        NODE_ENV: 'test',
      }

      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnValue({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        }),
      }

      const mockScheduler = {
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
      }

      vi.doMock('../../src/config/env-config.js', () => ({
        loadConfig: vi.fn().mockReturnValue(mockConfig),
      }))

      vi.doMock('../../src/logger/winston-logger.js', () => ({
        createLogger: vi.fn().mockReturnValue(mockLogger),
      }))

      vi.doMock('../../src/scheduler/cron-scheduler.js', () => ({
        createScheduler: vi.fn().mockReturnValue(mockScheduler),
      }))

      const mockSetupGracefulShutdown = vi.fn()

      vi.doMock('../../src/shutdown/graceful-shutdown.js', () => ({
        setupGracefulShutdown: mockSetupGracefulShutdown,
      }))

      // Act
      const { main } = await import('../../src/index.js')
      await main()

      // Assert
      expect(mockSetupGracefulShutdown).toHaveBeenCalledWith({
        timeoutMs: 30000, // 30秒 * 1000
        scheduler: mockScheduler,
        logger: mockLogger,
      })
    })
  })

  // main()のエラーハンドリング（2件）
  describe('main()のエラーハンドリング', () => {
    it('main()内でエラー発生時にエラーがthrowされる', async () => {
      // Arrange
      const testError = new Error('テストエラー')

      vi.doMock('../../src/config/env-config.js', () => ({
        loadConfig: vi.fn().mockImplementation(() => {
          throw testError
        }),
      }))

      // Act & Assert
      const indexModule = await import('../../src/index.js')
      await expect(indexModule.main()).rejects.toThrow('テストエラー')
    })

    it('エラー発生時にエラーメッセージが保持される', async () => {
      // Arrange
      vi.doMock('../../src/config/env-config.js', () => ({
        loadConfig: vi.fn().mockImplementation(() => {
          throw new Error('設定読み込みエラー')
        }),
      }))

      // Act & Assert
      const indexModule = await import('../../src/index.js')
      await expect(indexModule.main()).rejects.toThrow('設定読み込みエラー')
    })
  })
})
