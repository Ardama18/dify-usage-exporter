/**
 * CLIエントリーポイント
 *
 * Commander.jsを使用したCLIコマンドの実行エントリーポイント。
 */

import { Command } from 'commander'
import { bootstrapCli } from './bootstrap.js'

async function main(): Promise<void> {
  const deps = bootstrapCli()
  const program = new Command()
  program.name('dify-usage-exporter').description('Dify usage data exporter CLI').version('1.0.0')

  // コマンド登録は後続タスクで追加
  // program.addCommand(createResendCommand(deps))
  // program.addCommand(createWatermarkCommand(deps))
  // program.addCommand(createListCommand(deps))

  // 依存関係を変数として保持（lintエラー回避、後続タスクで使用）
  void deps

  await program.parseAsync()
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
