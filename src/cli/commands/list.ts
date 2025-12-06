/**
 * listコマンド
 *
 * data/failed/内の失敗ファイル一覧を表示する。
 */

import { Command } from 'commander'
import type { CliDependencies } from '../bootstrap.js'
import type { FailedFileInfo } from '../types.js'

/**
 * ファイル名からファイル情報を抽出するヘルパー関数
 *
 * ファイル名パターン: failed_{timestamp}_{batchKey}.json
 */
function extractFilenameFromBatchKey(batchKey: string | undefined): string {
  if (!batchKey) {
    return 'failed_*.json'
  }
  // 実際のファイル名は SpoolFile からは取得できないため、
  // batchIdempotencyKey を使って識別情報を提供
  return `failed_*_${batchKey}.json`
}

/**
 * listコマンドを作成
 *
 * @param deps - CLI依存関係
 * @returns Commander Command
 */
export function createListCommand(deps: CliDependencies): Command {
  const { spoolManager } = deps

  const command = new Command('list')
    .description('List failed files in data/failed/')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      // Note: SpoolManager returns SpoolFile[] but we cast to unknown for backward compatibility
      const files = (await spoolManager.listFailedFiles()) as unknown as Array<{
        batchIdempotencyKey?: string
        records?: Array<{
          date: string
          app_id: string
          app_name: string
          token_count: number
          total_price: string
          currency: string
          idempotency_key: string
          transformed_at: string
        }>
        data?: Array<{
          date: string
          app_id: string
          app_name: string
          token_count: number
          total_price: string
          currency: string
          idempotency_key: string
          transformed_at: string
        }>
        firstAttempt?: string
        createdAt: string
        retryCount: number
        lastError?: string
      }>

      if (files.length === 0) {
        if (options.json) {
          console.log(
            JSON.stringify({
              files: [],
              totalFiles: 0,
              totalRecords: 0,
            }),
          )
        } else {
          console.log('No failed files')
        }
        return
      }

      // ファイル情報を整形
      const fileInfoList: FailedFileInfo[] = files.map((file) => {
        // LegacySpoolFileからrecords配列を取得（recordsまたはdataフィールド）
        const records = file.records ?? file.data ?? []
        const firstAttempt = file.firstAttempt ?? file.createdAt
        const lastError = file.lastError ?? 'Unknown error'

        return {
          filename: extractFilenameFromBatchKey(file.batchIdempotencyKey),
          recordCount: records.length,
          firstAttempt,
          lastError,
        }
      })

      const totalFiles = files.length
      const totalRecords = files.reduce((sum, file) => {
        const records = file.records ?? file.data ?? []
        return sum + records.length
      }, 0)

      if (options.json) {
        // JSON出力モード
        console.log(
          JSON.stringify({
            files: fileInfoList,
            totalFiles,
            totalRecords,
          }),
        )
        return
      }

      // 表形式出力
      console.log('Failed files in data/failed/:')
      console.log('')

      // ヘッダー
      console.log(
        '| Filename                                      | Records | First Attempt              | Last Error   |',
      )
      console.log(
        '|-----------------------------------------------|---------|----------------------------|--------------|',
      )

      // 各ファイルの情報を表示
      for (const info of fileInfoList) {
        const filename = info.filename.padEnd(45)
        const records = String(info.recordCount).padEnd(7)
        const firstAttempt = info.firstAttempt.substring(0, 19).replace('T', ' ').padEnd(26)
        const lastError = info.lastError.substring(0, 12).padEnd(12)

        console.log(`| ${filename} | ${records} | ${firstAttempt} | ${lastError} |`)
      }

      console.log('')
      console.log(`Total: ${totalFiles} files, ${totalRecords} records`)
    })

  return command
}
