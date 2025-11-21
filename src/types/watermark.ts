import { z } from 'zod'

export const watermarkSchema = z.object({
  last_fetched_date: z.string().datetime(),
  last_updated_at: z.string().datetime(),
})

export type Watermark = z.infer<typeof watermarkSchema>
