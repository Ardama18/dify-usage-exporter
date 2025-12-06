/**
 * プロバイダー名正規化
 *
 * Dify内部で使用されているプロバイダー名をAPI_Meter標準名にマッピングします。
 * 例: aws-bedrock → aws, xai/x-ai → xai
 */

/**
 * プロバイダー名マッピングテーブル
 * Dify内部名 → API_Meter標準名
 *
 * マッピングルール:
 * - 企業名を使用（サービス名・製品名ではなく）
 * - 小文字で統一
 * - 不明なプロバイダーは"unknown"を返す
 */
export const PROVIDER_MAPPING: Record<string, string> = {
  // 変更なし（既に標準名）
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',

  // 企業名への標準化
  'aws-bedrock': 'aws', // サービス名→企業名
  aws: 'aws',

  // xai統一（複数の表記を統一）
  xai: 'xai',
  'x-ai': 'xai',
  grok: 'xai', // 製品名→企業名

  // その他の可能性（将来追加）
  cohere: 'cohere',
  mistral: 'mistral',
  meta: 'meta',
}

/**
 * プロバイダー名正規化インターフェース
 */
export interface ProviderNormalizer {
  normalize(provider: string): string
}

/**
 * プロバイダー名正規化を実行するインスタンスを作成
 * @returns ProviderNormalizer
 */
export const createProviderNormalizer = (): ProviderNormalizer => {
  return {
    normalize(provider: string): string {
      const normalized = provider.trim().toLowerCase()

      // 空文字列の場合はunknown
      if (normalized === '') {
        return 'unknown'
      }

      return PROVIDER_MAPPING[normalized] || 'unknown'
    },
  }
}
