/**
 * CLIエントリーポイント
 *
 * Commander.jsを使用したCLIコマンドの実行エントリーポイント。
 */

import { Command } from 'commander'
import { bootstrapCli } from './bootstrap.js'
import { createListCommand } from './commands/list.js'

async function main(): Promise<void> {
  const deps = bootstrapCli()
  const program = new Command()
  program.name('dify-usage-exporter').description('Dify usage data exporter CLI').version('1.0.0')

  // コマンド登録
  program.addCommand(createListCommand(deps))
  // program.addCommand(createResendCommand(deps))
  // program.addCommand(createWatermarkCommand(deps))

  await program.parseAsync()
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
