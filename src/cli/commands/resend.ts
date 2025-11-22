/**
 * resendコマンド
 *
 * data/failed/内の失敗ファイルを手動で再送する。
 */

import { promises as fs } from 'node:fs'
import { Command } from 'commander'
import type { CliDependencies } from '../bootstrap.js'
import type { ResendResult, ResendSummary } from '../types.js'

/**
 * resendコマンドを作成
 *
 * @param deps - CLI依存関係
 * @returns Commander Command
 */
export function createResendCommand(deps: CliDependencies): Command {
  const { spoolManager, externalApiSender } = deps

  const command = new Command('resend')
    .description('Resend failed files to external API')
    .option('-f, --file <filename>', 'Resend specific file')
    .option('-a, --all', 'Resend all failed files')
    .action(async (options: { file?: string; all?: boolean }) => {
      // 引数なし: ファイル一覧表示
      if (!options.file && !options.all) {
        const files = await spoolManager.listFailedFiles()

        if (files.length === 0) {
          console.log('No failed files')
          return
        }

        console.log('Failed files in data/failed/:')
        console.log('')

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const firstAttempt = file.firstAttempt.substring(0, 19).replace('T', ' ')
          console.log(
            `  ${i + 1}. failed_*_${file.batchIdempotencyKey}.json (${file.records.length} records, first attempt: ${firstAttempt})`,
          )
        }

        const totalRecords = files.reduce((sum, file) => sum + file.records.length, 0)
        console.log('')
        console.log(`Total: ${files.length} files, ${totalRecords} records`)
        return
      }

      // --file: 指定ファイル再送
      if (options.file) {
        const filename = options.file
        const spoolFile = await spoolManager.getFailedFile(filename)

        if (!spoolFile) {
          console.error(`Error: File not found: ${filename}`)
          return
        }

        console.log(`Resending ${filename}...`)

        try {
          await externalApiSender.resendFailedFile(spoolFile.records)
          await spoolManager.deleteFailedFile(filename)
          console.log(`Successfully resent ${spoolFile.records.length} records`)
          console.log(`File deleted: ${filename}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`Failed to resend: ${errorMessage}`)
        }
        return
      }

      // --all: 全ファイル再送
      if (options.all) {
        const files = await spoolManager.listFailedFiles()

        if (files.length === 0) {
          console.log('No failed files')
          return
        }

        console.log('Resending all failed files...')

        const summary: ResendSummary = {
          successful: [],
          failed: [],
          totalRecords: 0,
        }

        // data/failed/ディレクトリ内のファイルを取得してマッピング
        const failedDir = 'data/failed'
        let fileNames: string[] = []
        try {
          fileNames = await fs.readdir(failedDir)
        } catch {
          console.log('No failed files directory')
          return
        }

        for (const file of files) {
          // batchIdempotencyKeyから対応するファイル名を検索
          const matchingFile = fileNames.find(
            (f) => f.includes(file.batchIdempotencyKey) && f.startsWith('failed_'),
          )

          if (!matchingFile) {
            continue
          }

          const result: ResendResult = {
            filename: matchingFile,
            success: false,
            recordCount: file.records.length,
          }

          try {
            await externalApiSender.resendFailedFile(file.records)
            await spoolManager.deleteFailedFile(matchingFile)
            result.success = true
            summary.successful.push(result)
            console.log(`  [ok] ${matchingFile}: ${file.records.length} records sent`)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            result.error = errorMessage
            summary.failed.push(result)
            console.error(`  [error] ${matchingFile}: Failed (${errorMessage})`)
          }

          summary.totalRecords += file.records.length
        }

        // サマリー表示
        console.log('')
        console.log('Summary:')
        const successRecords = summary.successful.reduce((sum, r) => sum + r.recordCount, 0)
        const failedRecords = summary.failed.reduce((sum, r) => sum + r.recordCount, 0)
        console.log(`  Successful: ${summary.successful.length} files (${successRecords} records)`)
        console.log(`  Failed: ${summary.failed.length} files (${failedRecords} records)`)
      }
    })

  return command
}
