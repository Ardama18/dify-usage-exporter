/**
 * resendコマンド
 *
 * data/failed/内の失敗ファイルを手動で再送する。
 */

import { promises as fs } from 'node:fs'
import { Command } from 'commander'
import type { CliDependencies } from '../bootstrap.js'

/**
 * resendコマンドを作成
 *
 * @param deps - CLI依存関係
 * @returns Commander Command
 */
export function createResendCommand(deps: CliDependencies): Command {
  const { spoolManager } = deps

  const command = new Command('resend')
    .description('Resend failed files to external API')
    .option('-f, --file <filename>', 'Resend specific file')
    .option('-a, --all', 'Resend all failed files')
    .action(async (options: { file?: string; all?: boolean }) => {
      // 引数なし: ファイル一覧表示
      if (!options.file && !options.all) {
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
          console.log('No failed files')
          return
        }

        console.log('Failed files in data/failed/:')
        console.log('')

        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const records = file.records ?? file.data ?? []
          const firstAttempt = (file.firstAttempt ?? file.createdAt)
            .substring(0, 19)
            .replace('T', ' ')
          const batchKey = file.batchIdempotencyKey ?? 'unknown'
          console.log(
            `  ${i + 1}. failed_*_${batchKey}.json (${records.length} records, first attempt: ${firstAttempt})`,
          )
        }

        const totalRecords = files.reduce((sum, file) => {
          const records = file.records ?? file.data ?? []
          return sum + records.length
        }, 0)
        console.log('')
        console.log(`Total: ${files.length} files, ${totalRecords} records`)
        return
      }

      // --file: 指定ファイル再送
      if (options.file) {
        const filename = options.file
        // Note: SpoolManager returns SpoolFile | null but we cast to unknown for backward compatibility
        const spoolFile = (await spoolManager.getFailedFile(filename)) as unknown as {
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
        } | null

        if (!spoolFile) {
          console.error(`Error: File not found: ${filename}`)
          return
        }

        console.log(`Resending ${filename}...`)

        // Note: resendFailedFile() is not yet implemented in ExternalApiSender
        // This functionality will be added in future updates
        console.error('Error: Manual resend functionality is not yet implemented')
        console.error('Please wait for future updates to enable this feature')
        return

        // TODO: Uncomment when resendFailedFile() is implemented
        // try {
        //   const records = spoolFile.records ?? spoolFile.data ?? []
        //   await externalApiSender.resendFailedFile(records)
        //   await spoolManager.deleteFailedFile(filename)
        //   console.log(`Successfully resent ${records.length} records`)
        //   console.log(`File deleted: ${filename}`)
        // } catch (error) {
        //   const errorMessage = error instanceof Error ? error.message : String(error)
        //   console.error(`Failed to resend: ${errorMessage}`)
        // }
        // return
      }

      // --all: 全ファイル再送
      if (options.all) {
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
          console.log('No failed files')
          return
        }

        console.log('Resending all failed files...')

        // data/failed/ディレクトリ内のファイルを取得してマッピング
        const failedDir = 'data/failed'
        try {
          await fs.readdir(failedDir)
        } catch {
          console.log('No failed files directory')
          return
        }

        // Note: resendFailedFile() is not yet implemented in ExternalApiSender
        console.error('Error: Manual resend functionality is not yet implemented')
        console.error('Please wait for future updates to enable this feature')
        return

        // TODO: Uncomment when resendFailedFile() is implemented
        // for (const file of files) {
        //   const batchKey = file.batchIdempotencyKey ?? 'unknown'
        //   const records = file.records ?? file.data ?? []
        //
        //   // batchIdempotencyKeyから対応するファイル名を検索
        //   const matchingFile = fileNames.find(
        //     (f) => f.includes(batchKey) && f.startsWith('failed_'),
        //   )
        //
        //   if (!matchingFile) {
        //     continue
        //   }
        //
        //   const result: ResendResult = {
        //     filename: matchingFile,
        //     success: false,
        //     recordCount: records.length,
        //   }
        //
        //   try {
        //     await externalApiSender.resendFailedFile(records)
        //     await spoolManager.deleteFailedFile(matchingFile)
        //     result.success = true
        //     summary.successful.push(result)
        //     console.log(`  [ok] ${matchingFile}: ${records.length} records sent`)
        //   } catch (error) {
        //     const errorMessage = error instanceof Error ? error.message : String(error)
        //     result.error = errorMessage
        //     summary.failed.push(result)
        //     console.error(`  [error] ${matchingFile}: Failed (${errorMessage})`)
        //   }
        //
        //   summary.totalRecords += records.length
        // }

        // TODO: Uncomment when resendFailedFile() is implemented
        // // サマリー表示
        // console.log('')
        // console.log('Summary:')
        // const successRecords = summary.successful.reduce((sum, r) => sum + r.recordCount, 0)
        // const failedRecords = summary.failed.reduce((sum, r) => sum + r.recordCount, 0)
        // console.log(`  Successful: ${summary.successful.length} files (${successRecords} records)`)
        // console.log(`  Failed: ${summary.failed.length} files (${failedRecords} records)`)
      }
    })

  return command
}
