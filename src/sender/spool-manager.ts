import { promises as fs } from 'node:fs'
import type { Logger } from '../logger/winston-logger.js'
import type { SpoolFile } from '../types/spool.js'
import { spoolFileSchema } from '../types/spool.js'
import { writeFileAtomic } from '../utils/file-utils.js'

/**
 * スプールファイル管理クラス
 *
 * 外部API送信に失敗したレコードをローカルファイルシステムへ保存し、
 * 再送時に読み込む機能を提供する。
 */
export class SpoolManager {
  private readonly spoolDir = 'data/spool'
  private readonly failedDir = 'data/failed'

  constructor(private readonly logger: Logger) {}

  /**
   * スプールファイルを保存
   *
   * @param spoolFile - 保存するスプールファイル
   */
  async saveToSpool(spoolFile: SpoolFile): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '')
    const fileName = `spool_${timestamp}_${spoolFile.batchIdempotencyKey}.json`
    const filePath = `${this.spoolDir}/${fileName}`

    await writeFileAtomic(filePath, JSON.stringify(spoolFile, null, 2), 0o600)

    this.logger.info('Spool file saved', {
      filePath,
      recordCount: spoolFile.records.length,
    })
  }

  /**
   * スプールファイルを一覧取得
   *
   * @returns firstAttempt昇順でソートされたスプールファイル配列
   */
  async listSpoolFiles(): Promise<SpoolFile[]> {
    try {
      await fs.access(this.spoolDir)
    } catch {
      // ディレクトリが存在しない場合は空配列を返す
      return []
    }

    const files = await fs.readdir(this.spoolDir)
    const spoolFiles: SpoolFile[] = []

    for (const file of files) {
      if (!file.startsWith('spool_')) continue

      const filePath = `${this.spoolDir}/${file}`
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data: unknown = JSON.parse(content)

        // zodバリデーション
        const parseResult = spoolFileSchema.safeParse(data)
        if (!parseResult.success) {
          this.logger.error('Corrupted spool file detected', {
            filePath,
            error: parseResult.error.format(),
          })
          // 破損ファイルをdata/failed/へ移動
          await this.moveToFailed(data as SpoolFile)
          continue
        }

        spoolFiles.push(parseResult.data)
      } catch (error) {
        this.logger.error('Failed to read spool file', { filePath, error })
      }
    }

    // firstAttempt昇順でソート（古いデータ優先）
    return spoolFiles.sort(
      (a, b) => new Date(a.firstAttempt).getTime() - new Date(b.firstAttempt).getTime(),
    )
  }

  /**
   * スプールファイルを削除
   *
   * @param batchKey - バッチ冪等キー
   */
  async deleteSpoolFile(batchKey: string): Promise<void> {
    const files = await fs.readdir(this.spoolDir)
    for (const file of files) {
      if (file.includes(batchKey)) {
        const filePath = `${this.spoolDir}/${file}`
        await fs.unlink(filePath)
        this.logger.info('Spool file deleted', { filePath })
      }
    }
  }

  /**
   * スプールファイルを更新
   *
   * @param spoolFile - 更新するスプールファイル
   */
  async updateSpoolFile(spoolFile: SpoolFile): Promise<void> {
    await this.deleteSpoolFile(spoolFile.batchIdempotencyKey)
    await this.saveToSpool(spoolFile)
    this.logger.info('Spool file updated', {
      batchKey: spoolFile.batchIdempotencyKey,
      retryCount: spoolFile.retryCount,
    })
  }

  /**
   * スプールファイルをdata/failed/へ移動
   *
   * @param spoolFile - 移動するスプールファイル
   */
  async moveToFailed(spoolFile: SpoolFile): Promise<void> {
    // data/failed/ディレクトリ作成
    await fs.mkdir(this.failedDir, { recursive: true })

    // ファイル移動
    const timestamp = new Date().toISOString().replace(/[:.]/g, '')
    const fileName = `failed_${timestamp}_${spoolFile.batchIdempotencyKey}.json`
    const filePath = `${this.failedDir}/${fileName}`

    await writeFileAtomic(filePath, JSON.stringify(spoolFile, null, 2), 0o600)

    // スプールファイル削除
    await this.deleteSpoolFile(spoolFile.batchIdempotencyKey)

    this.logger.info('Moved to failed', { filePath })
  }

  /**
   * 失敗ファイル一覧を取得
   *
   * @returns firstAttempt昇順でソートされた失敗ファイル配列
   */
  async listFailedFiles(): Promise<SpoolFile[]> {
    try {
      await fs.access(this.failedDir)
    } catch {
      // ディレクトリが存在しない場合は空配列を返す
      return []
    }

    const files = await fs.readdir(this.failedDir)
    const failedFiles: SpoolFile[] = []

    for (const file of files) {
      if (!file.startsWith('failed_')) continue

      const filePath = `${this.failedDir}/${file}`
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data: unknown = JSON.parse(content)

        // zodバリデーション
        const parseResult = spoolFileSchema.safeParse(data)
        if (!parseResult.success) {
          this.logger.error('Invalid failed file schema', {
            filePath,
            error: parseResult.error.format(),
          })
          continue
        }

        failedFiles.push(parseResult.data)
      } catch (error) {
        this.logger.error('Failed to read failed file', { filePath, error })
      }
    }

    // firstAttempt昇順でソート（古いデータ優先）
    return failedFiles.sort(
      (a, b) => new Date(a.firstAttempt).getTime() - new Date(b.firstAttempt).getTime(),
    )
  }

  /**
   * 指定した失敗ファイルを削除
   *
   * @param filename - 削除するファイル名
   */
  async deleteFailedFile(filename: string): Promise<void> {
    const filePath = `${this.failedDir}/${filename}`
    await fs.unlink(filePath)
    this.logger.info('Failed file deleted', { filePath })
  }

  /**
   * 指定したファイル名から失敗ファイルを取得
   *
   * @param filename - 取得するファイル名
   * @returns SpoolFile、存在しないかエラーの場合はnull
   */
  async getFailedFile(filename: string): Promise<SpoolFile | null> {
    const filePath = `${this.failedDir}/${filename}`

    try {
      await fs.access(filePath)
    } catch {
      // ファイルが存在しない場合はnull
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data: unknown = JSON.parse(content)

      // zodバリデーション
      const parseResult = spoolFileSchema.safeParse(data)
      if (!parseResult.success) {
        this.logger.error('Invalid failed file schema', {
          filePath,
          error: parseResult.error.format(),
        })
        return null
      }

      return parseResult.data
    } catch (error) {
      this.logger.error('Failed to read failed file', { filePath, error })
      return null
    }
  }
}
