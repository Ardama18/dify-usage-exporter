/**
 * listコマンド
 *
 * data/failed/内の失敗ファイル一覧を表示する。
 */

import { Command } from 'commander'
import type { SpoolFile } from '../../types/spool.js'
import type { CliDependencies } from '../bootstrap.js'
import type { FailedFileInfo } from '../types.js'

/**
 * SpoolFile (v2.0.0) からレコード数を取得するヘルパー関数
 */
function getRecordCount(file: SpoolFile): number {
  return file.data.records?.length ?? 0
}

/**
 * SpoolFileから識別情報を取得するヘルパー関数
 * export_timestamp をベースに識別子を生成
 */
function getFileIdentifier(file: SpoolFile): string {
  const timestamp = file.data.export_metadata?.export_timestamp ?? file.createdAt
  return timestamp.replace(/[:.]/g, '').substring(0, 15)
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
      // SpoolManagerは SpoolFile[] (v2.0.0形式のみ) を返す
      const files = await spoolManager.listFailedFiles()

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
        const recordCount = getRecordCount(file)
        const firstAttempt = file.createdAt
        const lastError = 'See logs' // v2.0.0 ではlastErrorフィールドがないため
        const identifier = getFileIdentifier(file)

        return {
          filename: `failed_*_${identifier}.json`,
          recordCount,
          firstAttempt,
          lastError,
        }
      })

      const totalFiles = files.length
      const totalRecords = files.reduce((sum, file) => sum + getRecordCount(file), 0)

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
