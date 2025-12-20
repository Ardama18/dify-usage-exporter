import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { Logger } from '../logger/winston-logger.js'
import type { ApiMeterRequest, ApiMeterUsageRecord } from '../types/api-meter-schema.js'
import { envSchema } from '../types/env.js'
import type { ExternalApiRecord } from '../types/external-api.js'
import type { LegacySpoolFile, SpoolFile } from '../types/spool.js'
import { legacySpoolFileSchema, spoolFileSchema } from '../types/spool.js'
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
   * 旧形式スプールファイル (ExternalApiRecord[]) を新形式 (ApiMeterRequest) に変換
   *
   * @param legacy - 旧形式スプールファイル
   * @returns 新形式ApiMeterRequest
   */
  private convertLegacySpoolFile(legacy: LegacySpoolFile): ApiMeterRequest {
    const env = envSchema.parse(process.env)

    this.logger.warn('Converting legacy spool file to new format', {
      version: legacy.version || 'unversioned',
      recordCount: legacy.records?.length || legacy.data?.length || 0,
    })

    // レコード取得 (records または data フィールドから)
    const legacyRecords: ExternalApiRecord[] = legacy.records || legacy.data || []

    // ExternalApiRecord → ApiMeterUsageRecord 変換
    const records: ApiMeterUsageRecord[] = legacyRecords.map((record) => {
      const sourceEventId = record.idempotency_key || `legacy-${record.date}-${Math.random()}`

      return {
        usage_date: record.date,
        provider: 'unknown', // 旧形式にはprovider情報がない
        model: 'unknown', // 旧形式にはmodel情報がない
        input_tokens: record.token_count, // 旧形式にはトークン内訳がないため、すべてinput_tokensに設定
        output_tokens: 0,
        total_tokens: record.token_count,
        request_count: 1, // 旧形式にはリクエスト数がない（デフォルト1）
        cost_actual: Number.parseFloat(record.total_price),
        currency: record.currency,
        metadata: {
          source_system: 'dify',
          source_event_id: sourceEventId,
          source_app_id: record.app_id,
          source_app_name: record.app_name,
          aggregation_method: 'daily_sum',
        },
      }
    })

    // 日付範囲を計算
    const dates = records.map((r) => new Date(r.usage_date))
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

    const apiMeterRequest: ApiMeterRequest = {
      tenant_id: env.API_METER_TENANT_ID,
      export_metadata: {
        exporter_version: '1.1.0',
        export_timestamp: new Date().toISOString(),
        aggregation_period: 'daily',
        source_system: 'dify',
        date_range: {
          start: minDate.toISOString(),
          end: maxDate.toISOString(),
        },
      },
      records,
    }

    return apiMeterRequest
  }

  /**
   * スプールファイルを保存 (新形式: ApiMeterRequest)
   *
   * @param request - API_Meterリクエスト
   * @returns 保存したファイル名
   */
  async save(request: ApiMeterRequest): Promise<string> {
    await fs.mkdir(this.spoolDir, { recursive: true })

    const filename = `spool-${Date.now()}.json`
    const filepath = path.join(this.spoolDir, filename)

    const spoolFile: SpoolFile = {
      version: '2.0.0',
      data: request,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }

    await writeFileAtomic(filepath, JSON.stringify(spoolFile, null, 2), 0o600)

    this.logger.info('Spool file saved (new format)', {
      filename,
      recordCount: request.records.length,
    })

    return filename
  }

  /**
   * スプールファイルを読み込む（旧形式→新形式変換を含む）
   *
   * @param filename - スプールファイル名
   * @returns API_Meterリクエスト
   * @throws {Error} - ファイルが存在しないか、形式が不正な場合
   */
  async load(filename: string): Promise<ApiMeterRequest> {
    const filepath = path.join(this.spoolDir, filename)
    const content = await fs.readFile(filepath, 'utf-8')
    const json: unknown = JSON.parse(content)

    // 新形式として解析を試みる
    const newFormatResult = spoolFileSchema.safeParse(json)
    if (newFormatResult.success) {
      this.logger.info('Loaded spool file (new format)', { filename })
      return newFormatResult.data.data
    }

    // 旧形式として解析を試みる
    const legacyResult = legacySpoolFileSchema.safeParse(json)
    if (legacyResult.success) {
      try {
        const converted = this.convertLegacySpoolFile(legacyResult.data)

        // 変換後のファイルを新形式で保存
        await this.save(converted)

        // 元のファイルを削除
        await fs.unlink(filepath)

        this.logger.info('Successfully converted and saved legacy spool file', {
          filename,
          recordCount: converted.records.length,
        })

        return converted
      } catch (error) {
        this.logger.error('Failed to convert legacy spool file', {
          filename,
          error: error instanceof Error ? error.message : String(error),
        })

        // 変換失敗時はfailedへ移動
        await this.moveToFailedByFilename(filename)
        throw new Error(`Failed to convert legacy spool file: ${filename}`)
      }
    }

    // どちらの形式でもない場合はfailedへ移動
    this.logger.error('Invalid spool file format', { filename })
    await this.moveToFailedByFilename(filename)
    throw new Error(`Invalid spool file format: ${filename}`)
  }

  /**
   * スプールファイルをdata/failed/へ移動（ファイル名指定）
   *
   * @param filename - 移動するファイル名
   */
  private async moveToFailedByFilename(filename: string): Promise<void> {
    await fs.mkdir(this.failedDir, { recursive: true })

    const sourcePath = path.join(this.spoolDir, filename)
    const destPath = path.join(this.failedDir, filename)

    await fs.rename(sourcePath, destPath)

    this.logger.info('Moved to failed directory', {
      filename,
      destPath,
    })
  }

  /**
   * スプールファイルを一覧取得 (新形式のみ)
   *
   * @returns createdAt昇順でソートされたスプールファイル配列
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
      if (!file.startsWith('spool-') || !file.endsWith('.json')) continue

      const filePath = path.join(this.spoolDir, file)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data: unknown = JSON.parse(content)

        // 新形式のzodバリデーション
        const parseResult = spoolFileSchema.safeParse(data)
        if (!parseResult.success) {
          this.logger.error('Corrupted spool file detected', {
            filePath,
            error: parseResult.error.format(),
          })
          // 破損ファイルをdata/failed/へ移動
          await this.moveToFailedByFilename(file)
          continue
        }

        spoolFiles.push(parseResult.data)
      } catch (error) {
        this.logger.error('Failed to read spool file', { filePath, error })
      }
    }

    // createdAt昇順でソート（古いデータ優先）
    return spoolFiles.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }

  /**
   * スプールファイルを削除 (ファイル名で指定)
   *
   * @param filename - 削除するファイル名
   */
  async deleteSpoolFile(filename: string): Promise<void> {
    const filePath = path.join(this.spoolDir, filename)
    await fs.unlink(filePath)
    this.logger.info('Spool file deleted', { filePath })
  }

  /**
   * 失敗ファイル一覧を取得 (新形式のみ)
   *
   * @returns createdAt昇順でソートされた失敗ファイル配列
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
      if (!file.endsWith('.json')) continue

      const filePath = path.join(this.failedDir, file)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data: unknown = JSON.parse(content)

        // 新形式のzodバリデーション
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

    // createdAt昇順でソート（古いデータ優先）
    return failedFiles.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }

  /**
   * 指定した失敗ファイルを削除
   *
   * @param filename - 削除するファイル名
   */
  async deleteFailedFile(filename: string): Promise<void> {
    const filePath = path.join(this.failedDir, filename)
    await fs.unlink(filePath)
    this.logger.info('Failed file deleted', { filePath })
  }

  /**
   * 指定したファイル名から失敗ファイルを取得 (新形式のみ)
   *
   * @param filename - 取得するファイル名
   * @returns SpoolFile、存在しないかエラーの場合はnull
   */
  async getFailedFile(filename: string): Promise<SpoolFile | null> {
    const filePath = path.join(this.failedDir, filename)

    try {
      await fs.access(filePath)
    } catch {
      // ファイルが存在しない場合はnull
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data: unknown = JSON.parse(content)

      // 新形式のzodバリデーション
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
