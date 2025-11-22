/**
 * watermarkコマンド
 *
 * ウォーターマーク（last_fetched_date）の表示・リセットを行う。
 */

import { Command } from 'commander'
import type { CliDependencies } from '../bootstrap.js'
import { confirmPrompt } from '../utils/prompt.js'

/**
 * watermarkコマンドを作成
 *
 * @param deps - CLI依存関係
 * @returns Commander Command
 */
export function createWatermarkCommand(deps: CliDependencies): Command {
  const { watermarkManager } = deps

  const command = new Command('watermark').description('Manage watermark (last_fetched_date)')

  // showサブコマンド
  command
    .command('show')
    .description('Show current watermark')
    .action(async () => {
      const watermark = await watermarkManager.load()
      if (!watermark) {
        console.log('Watermark not set')
        return
      }
      console.log('Current watermark:')
      console.log(`  last_fetched_date: ${watermark.last_fetched_date}`)
      console.log(`  last_updated_at:   ${watermark.last_updated_at}`)
    })

  // resetサブコマンド
  command
    .command('reset')
    .description('Reset watermark to specified date')
    .requiredOption('-d, --date <ISO8601>', 'Date to reset to (ISO 8601 format)')
    .action(async (options: { date: string }) => {
      // 日時バリデーション
      const newDate = new Date(options.date)
      if (Number.isNaN(newDate.getTime())) {
        console.error('Error: Invalid date format. Use ISO 8601 format.')
        process.exit(1)
      }

      // 現在値取得
      const current = await watermarkManager.load()

      // 確認表示
      console.log(`WARNING: This will reset the watermark to ${options.date}`)
      console.log('All data after this date will be re-fetched on next execution.')
      console.log()
      console.log(`Current: ${current?.last_fetched_date ?? 'Not set'}`)
      console.log(`New:     ${options.date}`)
      console.log()

      // 確認プロンプト
      const confirmed = await confirmPrompt('Are you sure?')
      if (!confirmed) {
        console.log('Reset cancelled')
        return
      }

      // リセット実行
      await watermarkManager.update({
        last_fetched_date: options.date,
        last_updated_at: new Date().toISOString(),
      })

      console.log(`Watermark reset to ${options.date}`)
    })

  return command
}
