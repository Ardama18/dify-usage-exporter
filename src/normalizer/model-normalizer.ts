/**
 * モデル名クレンジング
 *
 * Difyから取得したモデル名をクレンジング（小文字化・trim）して返します。
 * マッピングは行わず、Difyのデータをそのまま転送します。
 *
 * ADR 020: Exporter正規化層の責務削減とデータ忠実性の確保
 */

/**
 * モデル名正規化インターフェース
 */
export interface ModelNormalizer {
  normalize(model: string): string
}

/**
 * モデル名クレンジングを実行するインスタンスを作成
 * @returns ModelNormalizer
 */
export const createModelNormalizer = (): ModelNormalizer => {
  return {
    normalize(model: string): string {
      const cleaned = model.trim().toLowerCase()
      return cleaned === '' ? 'unknown' : cleaned
    },
  }
}
