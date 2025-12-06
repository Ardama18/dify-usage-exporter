/**
 * モデル名正規化
 *
 * Dify内部で使用されているモデル名を公式識別子（バージョン番号含む）にマッピングします。
 * 例: claude-3-5-sonnet → claude-3-5-sonnet-20241022, gpt-4 → gpt-4-0613
 */

/**
 * モデル名マッピングテーブル
 * Dify内部名 → 公式識別子（バージョン番号含む）
 *
 * マッピングルール:
 * - 公式識別子を使用（バージョン番号を含む）
 * - 小文字で統一
 * - 不明なモデルはそのまま返す（unknownにしない）
 */
export const MODEL_MAPPING: Record<string, string> = {
  // Anthropic Claude
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',

  // OpenAI GPT-4
  'gpt-4': 'gpt-4-0613',
  'gpt-4-turbo': 'gpt-4-turbo-2024-04-09',
  'gpt-4o': 'gpt-4o-2024-08-06',

  // OpenAI GPT-3.5
  'gpt-3.5-turbo': 'gpt-3.5-turbo-0125',

  // Google Gemini
  'gemini-pro': 'gemini-1.0-pro',
  'gemini-1.5-pro': 'gemini-1.5-pro-002',

  // AWS Bedrock Claude（ARN形式→標準名）
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'claude-3-5-sonnet-20241022',
}

/**
 * モデル名正規化インターフェース
 */
export interface ModelNormalizer {
  normalize(model: string): string
}

/**
 * モデル名正規化を実行するインスタンスを作成
 * @returns ModelNormalizer
 */
export const createModelNormalizer = (): ModelNormalizer => {
  return {
    normalize(model: string): string {
      const normalized = model.trim().toLowerCase()

      // マッピングテーブル参照、不明な場合はそのまま返す
      return MODEL_MAPPING[normalized] || normalized
    },
  }
}
