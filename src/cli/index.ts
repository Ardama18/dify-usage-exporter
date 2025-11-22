/**
 * CLIエントリーポイント
 *
 * Commander.jsを使用したCLIコマンドの実行エントリーポイント。
 */

import { Command } from 'commander'
import { bootstrapCli } from './bootstrap.js'
import { createListCommand } from './commands/list.js'
import { createResendCommand } from './commands/resend.js'
import { handleError } from './utils/error-handler.js'

async function main(): Promise<void> {
  const deps = bootstrapCli()
  const program = new Command()
  program.name('dify-usage-exporter').description('Dify usage data exporter CLI').version('1.0.0')

  // コマンド登録
  program.addCommand(createListCommand(deps))
  program.addCommand(createResendCommand(deps))
  // program.addCommand(createWatermarkCommand(deps))

  // 未知のコマンド処理
  program.on('command:*', (operands) => {
    console.error(`Unknown command: ${operands.join(' ')}`)
    console.error(`Run 'dify-usage-exporter --help' for available commands.`)
    process.exit(1)
  })

  await program.parseAsync()
}

main().catch((error) => {
  handleError(error)
})
