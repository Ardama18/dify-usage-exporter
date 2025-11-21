import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../src/logger/winston-logger.js'
import type { EnvConfig } from '../../../src/types/env.js'
import type { Watermark } from '../../../src/types/watermark.js'

// モジュールのインポートはファイル作成後に行う
// import { createWatermarkManager, WatermarkFileError } from '../../../src/watermark/watermark-manager.js'

describe('WatermarkManager', () => {
  let testDir: string
  let config: EnvConfig
  let logger: Logger

  beforeEach(async () => {
    // テスト用一時ディレクトリを作成
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-test-'))

    // モックconfigの作成
    config = {
      DIFY_API_BASE_URL: 'https://api.dify.ai',
      DIFY_API_TOKEN: 'test-token',
      EXTERNAL_API_URL: 'https://external.api',
      EXTERNAL_API_TOKEN: 'external-token',
      CRON_SCHEDULE: '0 0 * * *',
      LOG_LEVEL: 'info',
      GRACEFUL_SHUTDOWN_TIMEOUT: 30,
      MAX_RETRY: 3,
      NODE_ENV: 'test',
      DIFY_FETCH_PAGE_SIZE: 100,
      DIFY_INITIAL_FETCH_DAYS: 30,
      DIFY_FETCH_TIMEOUT_MS: 30000,
      DIFY_FETCH_RETRY_COUNT: 3,
      DIFY_FETCH_RETRY_DELAY_MS: 1000,
      WATERMARK_FILE_PATH: path.join(testDir, 'watermark.json'),
    }

    // モックloggerの作成
    logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }
  })

  afterEach(async () => {
    // テスト後のクリーンアップ
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // クリーンアップ失敗は無視
    }
  })

  describe('load()', () => {
    it('ファイル存在時に正常にウォーターマークを読み込む', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }
      await fs.writeFile(config.WATERMARK_FILE_PATH, JSON.stringify(watermark, null, 2))

      const manager = createWatermarkManager({ config, logger })

      // Act
      const result = await manager.load()

      // Assert
      expect(result).toEqual(watermark)
      expect(logger.info).toHaveBeenCalledWith(
        'ウォーターマーク読み込み成功',
        expect.objectContaining({
          last_fetched_date: '2024-01-15T00:00:00.000Z',
        }),
      )
    })

    it('ファイル不存在時にnullを返却する', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const manager = createWatermarkManager({ config, logger })

      // Act
      const result = await manager.load()

      // Assert
      expect(result).toBeNull()
      expect(logger.info).toHaveBeenCalledWith('ウォーターマークファイル不存在（初回実行）')
    })

    it('ファイル破損時にバックアップから復元する', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const watermark: Watermark = {
        last_fetched_date: '2024-01-14T00:00:00.000Z',
        last_updated_at: '2024-01-14T10:30:00.000Z',
      }

      // 本ファイルを破損状態で作成
      await fs.writeFile(config.WATERMARK_FILE_PATH, 'invalid json {{{')

      // バックアップファイルを正常状態で作成
      await fs.writeFile(`${config.WATERMARK_FILE_PATH}.backup`, JSON.stringify(watermark, null, 2))

      const manager = createWatermarkManager({ config, logger })

      // Act
      const result = await manager.load()

      // Assert
      expect(result).toEqual(watermark)
      expect(logger.warn).toHaveBeenCalledWith(
        'ウォーターマークファイル破損、バックアップから復元試行',
        expect.any(Object),
      )
      expect(logger.info).toHaveBeenCalledWith(
        'バックアップから復元成功',
        expect.objectContaining({
          last_fetched_date: '2024-01-14T00:00:00.000Z',
        }),
      )
    })

    it('バックアップも破損時にWatermarkFileErrorをスローする', async () => {
      // Arrange
      const { createWatermarkManager, WatermarkFileError } = await import(
        '../../../src/watermark/watermark-manager.js'
      )

      // 本ファイルを破損状態で作成
      await fs.writeFile(config.WATERMARK_FILE_PATH, 'invalid json {{{')

      // バックアップファイルも破損状態で作成
      await fs.writeFile(`${config.WATERMARK_FILE_PATH}.backup`, 'also invalid {{{')

      const manager = createWatermarkManager({ config, logger })

      // Act & Assert
      await expect(manager.load()).rejects.toThrow(WatermarkFileError)
      await expect(manager.load()).rejects.toThrow(
        'ウォーターマークファイルとバックアップの復元に失敗',
      )
      expect(logger.error).toHaveBeenCalledWith('バックアップ復元失敗', expect.any(Object))
    })
  })

  describe('update()', () => {
    it('更新時にバックアップを作成する', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const oldWatermark: Watermark = {
        last_fetched_date: '2024-01-14T00:00:00.000Z',
        last_updated_at: '2024-01-14T10:30:00.000Z',
      }
      const newWatermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      // 既存ファイルを作成
      await fs.writeFile(config.WATERMARK_FILE_PATH, JSON.stringify(oldWatermark, null, 2))

      const manager = createWatermarkManager({ config, logger })

      // Act
      await manager.update(newWatermark)

      // Assert
      const backupPath = `${config.WATERMARK_FILE_PATH}.backup`
      const backupContent = await fs.readFile(backupPath, 'utf-8')
      const backupData = JSON.parse(backupContent)
      expect(backupData).toEqual(oldWatermark)
      expect(logger.debug).toHaveBeenCalledWith(
        'ウォーターマークバックアップ作成',
        expect.objectContaining({ backupPath }),
      )
    })

    it('パーミッション600でファイルを作成する', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const manager = createWatermarkManager({ config, logger })

      // Act
      await manager.update(watermark)

      // Assert
      const stats = await fs.stat(config.WATERMARK_FILE_PATH)
      // パーミッションを確認（600 = 0o600 = 384）
      // 注意: 実際のパーミッションはumaskの影響を受ける可能性がある
      const mode = stats.mode & 0o777
      expect(mode).toBe(0o600)
    })

    it('ディレクトリが存在しない場合に自動作成する', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const nestedDir = path.join(testDir, 'nested', 'dir')
      config.WATERMARK_FILE_PATH = path.join(nestedDir, 'watermark.json')

      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const manager = createWatermarkManager({ config, logger })

      // Act
      await manager.update(watermark)

      // Assert
      const content = await fs.readFile(config.WATERMARK_FILE_PATH, 'utf-8')
      const savedData = JSON.parse(content)
      expect(savedData).toEqual(watermark)
    })

    it('更新後に正しい内容が書き込まれる', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const manager = createWatermarkManager({ config, logger })

      // Act
      await manager.update(watermark)

      // Assert
      const content = await fs.readFile(config.WATERMARK_FILE_PATH, 'utf-8')
      const savedData = JSON.parse(content)
      expect(savedData).toEqual(watermark)
      expect(logger.info).toHaveBeenCalledWith(
        'ウォーターマーク更新成功',
        expect.objectContaining({
          last_fetched_date: '2024-01-15T00:00:00.000Z',
        }),
      )
    })

    it('ファイルが存在しない場合はバックアップを作成しない', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const watermark: Watermark = {
        last_fetched_date: '2024-01-15T00:00:00.000Z',
        last_updated_at: '2024-01-15T10:30:00.000Z',
      }

      const manager = createWatermarkManager({ config, logger })

      // Act
      await manager.update(watermark)

      // Assert
      const backupPath = `${config.WATERMARK_FILE_PATH}.backup`
      await expect(fs.access(backupPath)).rejects.toThrow()
      expect(logger.debug).not.toHaveBeenCalledWith(
        'ウォーターマークバックアップ作成',
        expect.any(Object),
      )
    })
  })

  describe('復元後のファイル整合性', () => {
    it('バックアップから復元後、本ファイルが正常になる', async () => {
      // Arrange
      const { createWatermarkManager } = await import('../../../src/watermark/watermark-manager.js')
      const watermark: Watermark = {
        last_fetched_date: '2024-01-14T00:00:00.000Z',
        last_updated_at: '2024-01-14T10:30:00.000Z',
      }

      // 本ファイルを破損状態で作成
      await fs.writeFile(config.WATERMARK_FILE_PATH, 'invalid json {{{')

      // バックアップファイルを正常状態で作成
      await fs.writeFile(`${config.WATERMARK_FILE_PATH}.backup`, JSON.stringify(watermark, null, 2))

      const manager = createWatermarkManager({ config, logger })

      // Act
      await manager.load()

      // Assert - 本ファイルがバックアップから復元されていることを確認
      const restoredContent = await fs.readFile(config.WATERMARK_FILE_PATH, 'utf-8')
      const restoredData = JSON.parse(restoredContent)
      expect(restoredData).toEqual(watermark)
    })
  })
})
