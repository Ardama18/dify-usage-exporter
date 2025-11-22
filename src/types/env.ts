import { z } from 'zod'

export const envSchema = z
  .object({
    // 必須環境変数
    DIFY_API_BASE_URL: z.string().url(),
    DIFY_API_TOKEN: z.string().min(1),
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
    DIFY_INITIAL_FETCH_DAYS: z.coerce.number().min(1).max(365).default(30),
    DIFY_FETCH_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000),
    DIFY_FETCH_RETRY_COUNT: z.coerce.number().min(1).max(10).default(3),
    DIFY_FETCH_RETRY_DELAY_MS: z.coerce.number().min(100).max(10000).default(1000),
    WATERMARK_FILE_PATH: z.string().default('data/watermark.json'),

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
