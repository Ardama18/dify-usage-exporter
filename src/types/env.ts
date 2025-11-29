import { z } from 'zod'

// 期間指定モード
export const fetchPeriodEnum = z.enum([
  'current_month', // 今月
  'last_month', // 先月
  'current_week', // 今週
  'last_week', // 先週
  'custom', // カスタム（START_DATE/END_DATEを使用）
])
export type FetchPeriod = z.infer<typeof fetchPeriodEnum>

// 集計周期モード
export const aggregationPeriodEnum = z.enum([
  'monthly', // 月単位
  'weekly', // 週単位
  'daily', // 日単位
])
export type AggregationPeriod = z.infer<typeof aggregationPeriodEnum>

// 出力モード
export const outputModeEnum = z.enum([
  'per_app', // アプリ毎
  'workspace', // ワークスペース全体
  'both', // 両方（per_app + workspace）
  'per_user', // ユーザー毎（ログAPIベース）
  'per_model', // ユーザー・モデル毎（ノード実行詳細ベース、価格情報付き）
  'all', // 全て（per_app + workspace + per_user + per_model）
])
export type OutputMode = z.infer<typeof outputModeEnum>

export const envSchema = z
  .object({
    // 必須環境変数
    DIFY_API_BASE_URL: z.string().url(),
    DIFY_EMAIL: z.string().email(),
    DIFY_PASSWORD: z.string().min(1),
    EXTERNAL_API_URL: z.string().url(),
    EXTERNAL_API_TOKEN: z.string().min(1),

    // オプション環境変数（デフォルト値あり）
    CRON_SCHEDULE: z.string().default('0 0 * * *'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    GRACEFUL_SHUTDOWN_TIMEOUT: z.coerce.number().min(1).max(300).default(30),
    MAX_RETRY: z.coerce.number().min(1).max(10).default(3),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

    // Dify Fetcher関連（オプション、デフォルト値あり）
    DIFY_FETCH_PAGE_SIZE: z.coerce.number().min(1).max(1000).default(100),
    DIFY_FETCH_DAYS: z.coerce.number().min(1).max(365).default(30), // 取得する過去日数（後方互換性のため残す）
    DIFY_FETCH_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000),
    DIFY_FETCH_RETRY_COUNT: z.coerce.number().min(1).max(10).default(3),
    DIFY_FETCH_RETRY_DELAY_MS: z.coerce.number().min(100).max(10000).default(1000),
    WATERMARK_FILE_PATH: z.string().default('data/watermark.json'),
    WATERMARK_ENABLED: z
      .string()
      .default('false')
      .transform((val) => val.toLowerCase() === 'true'), // true: 差分取得、false: 常に過去N日分を取得

    // 期間指定・集計・出力モード
    DIFY_FETCH_PERIOD: fetchPeriodEnum.default('current_month'), // 期間指定モード
    DIFY_FETCH_START_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // カスタム開始日（YYYY-MM-DD）
    DIFY_FETCH_END_DATE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // カスタム終了日（YYYY-MM-DD）
    DIFY_AGGREGATION_PERIOD: aggregationPeriodEnum.default('monthly'), // 集計周期
    DIFY_OUTPUT_MODE: outputModeEnum.default('per_app'), // 出力モード

    // External API Sender関連（Story 4）
    EXTERNAL_API_TIMEOUT_MS: z.coerce
      .number()
      .min(1000, 'Timeout must be at least 1000ms')
      .default(30000),
    MAX_RETRIES: z.coerce.number().min(0, 'Retries must be non-negative').default(3),
    MAX_SPOOL_RETRIES: z.coerce.number().min(0, 'Spool retries must be non-negative').default(10),
    BATCH_SIZE: z.coerce.number().min(1, 'Batch size must be at least 1').default(100),

    // Healthcheck関連（Story 5）
    HEALTHCHECK_PORT: z.coerce.number().default(8080),
    HEALTHCHECK_ENABLED: z
      .string()
      .default('true')
      .transform((val) => val.toLowerCase() === 'true'),
  })
  .refine((data) => data.EXTERNAL_API_URL.startsWith('https://'), {
    message: 'EXTERNAL_API_URL must use HTTPS protocol',
    path: ['EXTERNAL_API_URL'],
  })

export type EnvConfig = z.infer<typeof envSchema>
