/**
 * Providerを正規化する（小文字変換・空白除去）
 * @param provider 正規化対象のプロバイダー名
 * @returns 正規化されたプロバイダー名
 */
export function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase()
}

/**
 * Modelを正規化する（小文字変換・空白除去）
 * @param model 正規化対象のモデル名
 * @returns 正規化されたモデル名
 */
export function normalizeModel(model: string): string {
  return model.trim().toLowerCase()
}
