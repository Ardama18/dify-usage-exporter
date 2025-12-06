---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 008
phase: 3
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: スプール機構の更新

メタ情報:
- 依存: task-api-meter-interface-update-phase3-002 → 成果物: src/sender/external-api-sender.ts
- 提供: src/types/spool.ts（更新）, src/sender/spool-manager.ts（更新）
- サイズ: 中規模（3ファイル: 型定義 + 実装 + テスト）

## 実装内容

スプール機構を新形式（`ApiMeterRequest`）に対応させ、旧形式スプールファイルの変換機能を実装します。

### 実装するもの
1. `legacySpoolFileSchema` の追加（旧形式スプールファイルのzodスキーマ）
2. `convertLegacySpoolFile()` 関数（旧形式 → 新形式変換）
3. 旧形式検出時の警告ログ出力
4. 変換失敗時の `data/failed/` への移動

### 変換ルール
- 旧形式の `ExternalApiRecord[]` → 新形式の `ApiMeterRequest`
- provider/model情報が不足している場合は "unknown" に設定
- 変換失敗時は `data/failed/` へ移動し、手動対応を要求

## 対象ファイル

- [ ] src/types/spool.ts（更新）
- [ ] src/sender/spool-manager.ts（更新）
- [ ] src/sender/__tests__/spool-manager.test.ts（更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 依存成果物の確認: `src/sender/external-api-sender.ts` が更新されている
- [ ] `src/sender/__tests__/spool-manager.test.ts` を更新
- [ ] 失敗するテストを追加:
  - 旧形式スプールファイルの検出テスト
  - 旧形式 → 新形式変換のテスト
  - 変換失敗時の `data/failed/` 移動テスト
  - 新形式スプールファイルの保存・読み込みテスト
- [ ] テスト実行して失敗を確認: `npm test src/sender/spool-manager.test.ts`

### 2. Green Phase

#### 2-1. spool.ts の更新
```typescript
// src/types/spool.ts
import { z } from 'zod'
import { apiMeterRequestSchema } from './api-meter-schema'

// 新形式スプールファイル（ApiMeterRequest）
export const spoolFileSchema = z.object({
  version: z.literal('2.0.0'),
  data: apiMeterRequestSchema,
  createdAt: z.string().datetime(),
  retryCount: z.number().int().nonnegative().default(0),
})

export type SpoolFile = z.infer<typeof spoolFileSchema>

// 旧形式スプールファイル（ExternalApiRecord[]）
export const legacySpoolFileSchema = z.object({
  version: z.literal('1.0.0').optional(),
  data: z.array(z.object({
    // ExternalApiRecordの定義（簡略版）
    date: z.string(),
    provider: z.string().optional(),
    model: z.string().optional(),
    // ...
  })),
  createdAt: z.string().datetime(),
  retryCount: z.number().int().nonnegative().default(0),
})

export type LegacySpoolFile = z.infer<typeof legacySpoolFileSchema>
```

#### 2-2. spool-manager.ts の更新
```typescript
// src/sender/spool-manager.ts
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { ApiMeterRequest } from '../types/api-meter-schema'
import type { SpoolFile, LegacySpoolFile } from '../types/spool'
import { spoolFileSchema, legacySpoolFileSchema } from '../types/spool'
import { loadEnv } from '../types/env'

export class SpoolManager {
  private spoolDir: string
  private failedDir: string

  constructor(spoolDir = 'data/spool', failedDir = 'data/failed') {
    this.spoolDir = spoolDir
    this.failedDir = failedDir
  }

  /**
   * 旧形式スプールファイルを新形式に変換
   */
  private convertLegacySpoolFile(legacy: LegacySpoolFile): SpoolFile {
    const env = loadEnv()

    console.warn('Converting legacy spool file to new format')

    const records = legacy.data.map((record) => ({
      source_event_id: `legacy-${record.date}-${Math.random()}`, // 一時的なID
      usage_date: record.date,
      provider: record.provider || 'unknown',
      model: record.model || 'unknown',
      input_tokens: record.inputTokens || 0,
      output_tokens: record.outputTokens || 0,
      total_tokens: record.totalTokens || 0,
      cost_actual: record.costActual || 0,
      aggregation_method: 'sum' as const,
      source_system: 'dify-usage-exporter',
      app_id: record.appId,
      user_id: record.userId,
    }))

    return {
      version: '2.0.0',
      data: {
        tenant_id: env.API_METER_TENANT_ID,
        records,
        export_metadata: {
          export_date_start: new Date().toISOString(),
          export_date_end: new Date().toISOString(),
          source_system: 'dify-usage-exporter',
          export_version: '1.1.0',
        },
      },
      createdAt: legacy.createdAt,
      retryCount: legacy.retryCount,
    }
  }

  /**
   * スプールファイルを読み込む（旧形式→新形式変換を含む）
   */
  async load(filename: string): Promise<ApiMeterRequest> {
    const filepath = path.join(this.spoolDir, filename)
    const content = await fs.readFile(filepath, 'utf-8')
    const json = JSON.parse(content)

    // 新形式として解析を試みる
    const newFormatResult = spoolFileSchema.safeParse(json)
    if (newFormatResult.success) {
      return newFormatResult.data.data
    }

    // 旧形式として解析を試みる
    const legacyResult = legacySpoolFileSchema.safeParse(json)
    if (legacyResult.success) {
      try {
        const converted = this.convertLegacySpoolFile(legacyResult.data)

        // 変換後のファイルを保存
        await this.save(converted.data)

        // 元のファイルを削除
        await fs.unlink(filepath)

        console.log(`Successfully converted legacy spool file: ${filename}`)
        return converted.data
      } catch (error) {
        console.error(`Failed to convert legacy spool file: ${filename}`, error)
        await this.moveToFailed(filename)
        throw new Error(`Failed to convert legacy spool file: ${filename}`)
      }
    }

    // どちらの形式でもない場合はfailedへ移動
    await this.moveToFailed(filename)
    throw new Error(`Invalid spool file format: ${filename}`)
  }

  /**
   * スプールファイルを保存
   */
  async save(request: ApiMeterRequest): Promise<string> {
    await fs.mkdir(this.spoolDir, { recursive: true })

    const filename = `spool-${Date.now()}.json`
    const filepath = path.join(this.spoolDir, filename)

    const spoolFile: SpoolFile = {
      version: '2.0.0',
      data: request,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }

    await fs.writeFile(filepath, JSON.stringify(spoolFile, null, 2), 'utf-8')
    console.log(`Saved spool file: ${filename}`)

    return filename
  }

  /**
   * スプールファイルをfailedディレクトリへ移動
   */
  private async moveToFailed(filename: string): Promise<void> {
    await fs.mkdir(this.failedDir, { recursive: true })

    const sourcePath = path.join(this.spoolDir, filename)
    const destPath = path.join(this.failedDir, filename)

    await fs.rename(sourcePath, destPath)
    console.log(`Moved to failed directory: ${filename}`)
  }
}
```

- [ ] 追加したテストのみ実行して通ることを確認: `npm test src/sender/spool-manager.test.ts`

### 3. Refactor Phase
- [ ] エラーハンドリングの改善
- [ ] ログ出力の充実化
- [ ] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm test src/sender/spool-manager.test.ts
  ```
- [x] 成果物作成完了:
  - `src/types/spool.ts`（更新）
  - `src/sender/spool-manager.ts`（更新）

## テストケース

### 正常系
- [ ] 新形式スプールファイルの保存
- [ ] 新形式スプールファイルの読み込み
- [ ] 旧形式スプールファイルの検出
- [ ] 旧形式 → 新形式変換成功
- [ ] 変換後のファイルが正しく保存される

### 異常系
- [ ] 旧形式変換失敗時に `data/failed/` へ移動
- [ ] 不正な形式のスプールファイルを `data/failed/` へ移動
- [ ] 変換後のファイルが zodスキーマでバリデーション成功

## 注意事項

- **影響範囲**:
  - `src/types/spool.ts` の更新
  - `src/sender/spool-manager.ts` の更新
  - 旧形式スプールファイルの変換機能追加
- **制約**:
  - 旧形式スプールファイルは provider/model を "unknown" に設定
  - 変換失敗時は手動対応を要求
- **重要な変更点**:
  - スプールファイル形式の変更（ExternalApiRecord[] → ApiMeterRequest）
  - バージョン管理の導入（version: "2.0.0"）
- **互換性考慮**:
  - 旧形式スプールファイルの自動変換
  - 変換失敗時の適切なエラーハンドリング
- **次タスクへの引き継ぎ**:
  - Task 4-1 でデータフロー全体に統合

## 参考資料

- [Design Document](../design.md) - 第8章「スプール機構の更新」
- [ADR 018: スプール機構統合](../../adr/018-spool-integration.md)
