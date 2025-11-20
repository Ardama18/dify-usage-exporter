import dotenv from 'dotenv'
import { type EnvConfig, envSchema } from '../types/env.js'

export function loadConfig(): EnvConfig {
  dotenv.config()

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('環境変数の検証に失敗しました:')
    console.error(result.error.format())
    process.exit(1)
  }

  return result.data
}
