/**
 * プロバイダー名クレンジング
 *
 * Difyから取得したプロバイダー名をクレンジング（小文字化・trim）して返します。
 * マッピングは行わず、Difyのデータをそのまま転送します。
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
      const cleaned = provider.trim().toLowerCase()
      return cleaned === '' ? 'unknown' : cleaned
    },
  }
}
