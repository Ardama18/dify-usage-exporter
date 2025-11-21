import fs from 'node:fs/promises'
import path from 'node:path'
import type { Logger } from '../logger/winston-logger.js'
import type { EnvConfig } from '../types/env.js'
import type { Watermark } from '../types/watermark.js'

export interface WatermarkManagerDeps {
  config: EnvConfig
  logger: Logger
}

export function createWatermarkManager(deps: WatermarkManagerDeps): WatermarkManager {
  const { config, logger } = deps
  const filePath = config.WATERMARK_FILE_PATH
  const backupPath = `${filePath}.backup`

  return {
    async load(): Promise<Watermark | null> {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const watermark = JSON.parse(content) as Watermark
        logger.info('ウォーターマーク読み込み成功', {
          last_fetched_date: watermark.last_fetched_date,
        })
        return watermark
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          logger.info('ウォーターマークファイル不存在（初回実行）')
          return null
        }

        // 破損時はバックアップから復元を試行
        logger.warn('ウォーターマークファイル破損、バックアップから復元試行', { error })
        try {
          const backupContent = await fs.readFile(backupPath, 'utf-8')
          const watermark = JSON.parse(backupContent) as Watermark

          // バックアップから本ファイルを復元
          await fs.writeFile(filePath, backupContent, { mode: 0o600 })
          logger.info('バックアップから復元成功', {
            last_fetched_date: watermark.last_fetched_date,
          })
          return watermark
        } catch (restoreError) {
          logger.error('バックアップ復元失敗', { restoreError })
          throw new WatermarkFileError('ウォーターマークファイルとバックアップの復元に失敗')
        }
      }
    },

    async update(watermark: Watermark): Promise<void> {
      const content = JSON.stringify(watermark, null, 2)
      const dir = path.dirname(filePath)

      // ディレクトリ作成（存在しない場合）
      await fs.mkdir(dir, { recursive: true })

      // 既存ファイルのバックアップ作成
      try {
        await fs.access(filePath)
        await fs.copyFile(filePath, backupPath)
        logger.debug('ウォーターマークバックアップ作成', { backupPath })
      } catch {
        // ファイルが存在しない場合はバックアップ不要
      }

      // 新しいウォーターマークを書き込み
      await fs.writeFile(filePath, content, { mode: 0o600 })
      logger.info('ウォーターマーク更新成功', {
        last_fetched_date: watermark.last_fetched_date,
      })
    },
  }
}

export interface WatermarkManager {
  load(): Promise<Watermark | null>
  update(watermark: Watermark): Promise<void>
}

export class WatermarkFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WatermarkFileError'
  }
}
