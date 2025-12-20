/**
 * プロバイダー名クレンジング
 *
 * Difyから取得したプロバイダー名をクレンジングして返します。
 * - 小文字化・trim
 * - パス形式（langgenius/openai/openai）の場合は最後の部分を抽出
 *
 * ADR 020: Exporter正規化層の責務削減とデータ忠実性の確保
 */

/**
 * プロバイダー名正規化インターフェース
 */
export interface ProviderNormalizer {
  normalize(provider: string): string
}

/**
 * プロバイダー名クレンジングを実行するインスタンスを作成
 * @returns ProviderNormalizer
 */
export const createProviderNormalizer = (): ProviderNormalizer => {
  return {
    normalize(provider: string): string {
      let cleaned = provider.trim().toLowerCase()
      if (cleaned === '') {
        return 'unknown'
      }
      // パス形式（例: langgenius/openai/openai）の場合は最後の部分を抽出
      if (cleaned.includes('/')) {
        const parts = cleaned.split('/')
        cleaned = parts[parts.length - 1]
      }
      return cleaned === '' ? 'unknown' : cleaned
    },
  }
}
