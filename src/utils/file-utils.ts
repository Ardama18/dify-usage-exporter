import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'

/**
 * アトミックファイル書き込み
 * @param filePath - 書き込み先ファイルパス
 * @param content - 書き込み内容
 * @param mode - ファイルパーミッション（デフォルト: 0o600）
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
  mode: number = 0o600,
): Promise<void> {
  const tempPath = `${filePath}.tmp`

  try {
    // ディレクトリ作成
    await ensureDirectory(dirname(filePath))

    // 一時ファイルへ書き込み
    await fs.writeFile(tempPath, content, { mode })

    // リネーム（アトミック操作）
    await fs.rename(tempPath, filePath)
  } catch (error) {
    // 失敗時は一時ファイル削除
    try {
      await fs.unlink(tempPath)
    } catch {
      // 削除失敗は無視
    }
    throw error
  }
}

/**
 * パーミッション600設定
 * @param filePath - ファイルパス
 */
export async function setPermission600(filePath: string): Promise<void> {
  await fs.chmod(filePath, 0o600)
}

/**
 * ディレクトリ作成（存在しない場合）
 * @param dirPath - ディレクトリパス
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}
