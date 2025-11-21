import { z } from 'zod'

export const envSchema = z.object({
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
})

export type EnvConfig = z.infer<typeof envSchema>
