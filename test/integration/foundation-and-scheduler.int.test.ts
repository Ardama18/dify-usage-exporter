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
