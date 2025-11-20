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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert
      expect(config).toBeDefined()
      expect(config.DIFY_API_URL).toBe('https://api.dify.ai')
      expect(config.DIFY_API_TOKEN).toBe('dify-token-123')
      expect(config.EXTERNAL_API_URL).toBe('https://external.api.com')
      expect(config.EXTERNAL_API_TOKEN).toBe('external-token-456')
    })

    it('返却値がEnvConfig型に準拠する', async () => {
      // Arrange
      process.env.DIFY_API_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      process.env.LOG_LEVEL = 'debug'
      process.env.MAX_RETRY = '5'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config = loadConfig()

      // Assert - 全プロパティが存在することを確認
      expect(config).toHaveProperty('DIFY_API_URL')
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
    it('DIFY_API_URL未設定でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'
      // DIFY_API_URLは未設定

      // Act & Assert
      const { loadConfig } = await import('../../src/config/env-config.js')
      expect(() => loadConfig()).toThrow('process.exit called')
      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('DIFY_API_TOKEN未設定でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
    it('DIFY_API_URLが不正なURL形式でexit(1)が呼ばれる', async () => {
      // Arrange
      process.env.DIFY_API_URL = 'not-a-valid-url'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
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
      process.env.DIFY_API_URL = 'https://api.dify.ai'
      process.env.DIFY_API_TOKEN = 'dify-token-123'
      process.env.EXTERNAL_API_URL = 'https://external.api.com'
      process.env.EXTERNAL_API_TOKEN = 'external-token-456'

      // Act
      const { loadConfig } = await import('../../src/config/env-config.js')
      const config1 = loadConfig()
      const config2 = loadConfig()

      // Assert
      expect(config1).toEqual(config2)
      expect(config1.DIFY_API_URL).toBe(config2.DIFY_API_URL)
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
    process.env.DIFY_API_URL = 'https://api.dify.ai'
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
        difyApiUrl: config.DIFY_API_URL,
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
