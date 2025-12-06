---
id: 018
feature: api-meter-interface-migration
type: adr
version: 1.0.0
created: 2025-12-04
based_on: requirements analysis for API_Meter new specification
---

# ADR 018: スプール機構統合

## ステータス

Proposed

## コンテキスト

API_Meterの新仕様（2025-12-04版）への移行に伴い、既存のスプールファイル形式を新形式へ変換する必要がある。既存スプールファイルは旧型（`ExternalApiRecord`）で保存されているが、新仕様では`ApiMeterUsageRecord`形式が必要となる。

### 既存のスプールファイル形式（ADR 001）

```json
{
  "batchIdempotencyKey": "a3f2e1b9c4d5...",
  "records": [
    {
      "date": "2025-11-29",
      "app_id": "abc123",
      "app_name": "FAQ Bot",
      "token_count": 15000,
      "total_price": "0.1050000",
      "currency": "USD",
      "idempotency_key": "2025-11-29_abc123_...",
      "transformed_at": "2025-11-30T10:00:00Z"
    }
  ],
  "firstAttempt": "2025-11-30T10:00:00Z",
  "retryCount": 2,
  "lastError": "HTTP 503 Service Unavailable"
}
```

### 新仕様のスプールファイル形式

```json
{
  "batchIdempotencyKey": "a3f2e1b9c4d5...",
  "records": [
    {
      "usage_date": "2025-11-29",
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "input_tokens": 10000,
      "output_tokens": 5000,
      "total_tokens": 15000,
      "request_count": 25,
      "cost_actual": 0.1050000,
      "currency": "USD",
      "metadata": {
        "source_system": "dify",
        "source_event_id": "dify-20251129-anthropic-claude-3-5-sonnet-abc123",
        "source_app_id": "abc123",
        "source_app_name": "FAQ Bot",
        "aggregation_method": "daily_sum"
      }
    }
  ],
  "firstAttempt": "2025-11-30T10:00:00Z",
  "retryCount": 2,
  "lastError": "HTTP 503 Service Unavailable"
}
```

### 主要な不一致

1. **フィールド名**: date → usage_date, token_count → total_tokens
2. **新規必須フィールド**: provider, model, input_tokens, output_tokens, request_count, cost_actual
3. **メタデータ移動**: idempotency_key → metadata.source_event_id
4. **型の変更**: total_price（文字列） → cost_actual（数値）

### 制約事項

- 既存スプールファイルは旧形式で保存されている（data/spool/配下）
- スプール再送時に新形式へ変換が必要
- 変換失敗時は`data/failed/`へ移動し、手動対応を要求
- batchIdempotencyKeyは継続使用（スプールファイル管理に必要）

## 決定事項

### 1. 読み込み時に新形式へ変換

既存スプールファイルを破棄せず、SpoolManager読み込み時に新形式へ変換する：

```typescript
// src/sender/spool-manager.ts（拡張）

/**
 * 旧形式スプールファイルを新形式へ変換
 */
function convertLegacySpoolFile(legacyFile: LegacySpoolFile): SpoolFile | null {
  try {
    const newRecords: ApiMeterUsageRecord[] = []

    for (const legacyRecord of legacyFile.records) {
      // 旧形式レコードから新形式へ変換
      const newRecord: ApiMeterUsageRecord = {
        usage_date: legacyRecord.date,
        provider: 'unknown', // 旧形式にはprovider情報なし
        model: 'unknown', // 旧形式にはmodel情報なし
        input_tokens: 0, // 旧形式にはトークン内訳なし
        output_tokens: 0,
        total_tokens: legacyRecord.token_count,
        request_count: 1, // 旧形式にはリクエスト数なし
        cost_actual: parseFloat(legacyRecord.total_price),
        currency: legacyRecord.currency,
        metadata: {
          source_system: 'dify',
          source_event_id: legacyRecord.idempotency_key, // 既存冪等キーを流用
          source_app_id: legacyRecord.app_id,
          source_app_name: legacyRecord.app_name,
          aggregation_method: 'legacy_conversion',
        },
      }

      newRecords.push(newRecord)
    }

    // 新形式スプールファイルを生成
    const newSpoolFile: SpoolFile = {
      batchIdempotencyKey: legacyFile.batchIdempotencyKey,
      records: newRecords,
      firstAttempt: legacyFile.firstAttempt,
      retryCount: legacyFile.retryCount,
      lastError: legacyFile.lastError,
    }

    return newSpoolFile
  } catch (error) {
    logger.error('Failed to convert legacy spool file', { error })
    return null
  }
}
```

### 2. スプールファイル読み込みフロー

```typescript
// src/sender/spool-manager.ts
async listSpoolFiles(): Promise<SpoolFile[]> {
  try {
    await fs.access(this.spoolDir)
  } catch {
    return []
  }

  const files = await fs.readdir(this.spoolDir)
  const spoolFiles: SpoolFile[] = []

  for (const file of files) {
    if (!file.startsWith('spool_')) continue

    const filePath = `${this.spoolDir}/${file}`
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data: unknown = JSON.parse(content)

      // 新形式のバリデーション
      const parseResult = spoolFileSchema.safeParse(data)
      if (parseResult.success) {
        spoolFiles.push(parseResult.data)
        continue
      }

      // 旧形式のバリデーション
      const legacyParseResult = legacySpoolFileSchema.safeParse(data)
      if (legacyParseResult.success) {
        // 旧形式を新形式へ変換
        const convertedFile = convertLegacySpoolFile(legacyParseResult.data)
        if (convertedFile) {
          spoolFiles.push(convertedFile)
          this.logger.warn('Legacy spool file converted', { filePath })
          continue
        }
      }

      // 両形式でバリデーション失敗 → data/failed/へ移動
      this.logger.error('Corrupted spool file detected', {
        filePath,
        newFormatError: parseResult.error.format(),
        legacyFormatError: legacyParseResult.error.format(),
      })
      await this.moveToFailed(data as SpoolFile)
    } catch (error) {
      this.logger.error('Failed to read spool file', { filePath, error })
    }
  }

  return spoolFiles.sort(
    (a, b) => new Date(a.firstAttempt).getTime() - new Date(b.firstAttempt).getTime()
  )
}
```

### 3. 旧形式スキーマの定義

```typescript
// src/types/spool.ts（拡張）

/**
 * 旧形式スプールファイルのZodスキーマ
 */
export const legacySpoolFileSchema = z.object({
  batchIdempotencyKey: z.string(),
  records: z.array(externalApiRecordSchema), // 旧型
  firstAttempt: z.string().datetime(),
  retryCount: z.number().int().min(0),
  lastError: z.string(),
})

export type LegacySpoolFile = z.infer<typeof legacySpoolFileSchema>
```

### 4. 変換時の欠損データ対応

| 旧形式フィールド | 新形式フィールド | 変換方法 |
|--------------|--------------|---------|
| date | usage_date | そのまま使用 |
| app_id | metadata.source_app_id | そのまま使用 |
| app_name | metadata.source_app_name | そのまま使用 |
| token_count | total_tokens | そのまま使用 |
| total_price | cost_actual | parseFloat()で数値変換 |
| currency | currency | そのまま使用 |
| idempotency_key | metadata.source_event_id | 既存冪等キーを流用 |
| （なし） | provider | "unknown"を設定 |
| （なし） | model | "unknown"を設定 |
| （なし） | input_tokens | 0を設定 |
| （なし） | output_tokens | 0を設定 |
| （なし） | request_count | 1を設定（推定値） |
| （なし） | metadata.aggregation_method | "legacy_conversion"を設定 |

### 5. 変換失敗時の処理

- **変換失敗**: 旧形式→新形式変換エラー時は`data/failed/`へ移動
- **エラーログ**: 変換失敗の理由を詳細にログ出力
- **手動対応**: `data/failed/`配下のファイルは手動で確認・削除

## 根拠

### 検討した選択肢

#### 1. 既存スプールファイルを破棄（非推奨）

```typescript
// 既存スプールファイルを全て削除
await fs.rm(this.spoolDir, { recursive: true })
await fs.mkdir(this.spoolDir, { recursive: true })
```

**利点**:
- 実装が簡単（削除のみ）
- 新形式のみを扱うため、コードがシンプル

**欠点**:
- **データ損失**: 既存スプールファイルのデータが完全に失われる
- **監査証跡の消失**: 送信失敗履歴が消え、デバッグが困難
- **ユーザーへの影響**: 既存スプールファイルが送信されず、データ欠損
- **運用リスク**: 破棄後に問題が発覚しても復旧不可能

#### 2. 旧形式を新形式へ一括変換（非推奨）

```typescript
// マイグレーションスクリプトで一括変換
async function migrateAllSpoolFiles(): Promise<void> {
  const files = await listSpoolFiles()
  for (const file of files) {
    const converted = convertLegacySpoolFile(file)
    await saveToSpool(converted)
    await deleteSpoolFile(file.batchIdempotencyKey)
  }
}
```

**利点**:
- 変換が一度で完了
- 変換後は新形式のみ扱う

**欠点**:
- **マイグレーションタイミング**: デプロイ前に手動実行が必要
- **変換失敗リスク**: 一括変換時のエラーで全体が影響を受ける
- **ダウンタイム**: マイグレーション中は送信処理を停止する必要
- **ロールバック困難**: 変換後に旧バージョンへ戻せない

#### 3. 読み込み時に変換（採用）

```typescript
// SpoolManager.listSpoolFiles()で自動変換
const parseResult = spoolFileSchema.safeParse(data)
if (!parseResult.success) {
  const legacyParseResult = legacySpoolFileSchema.safeParse(data)
  if (legacyParseResult.success) {
    const converted = convertLegacySpoolFile(legacyParseResult.data)
    spoolFiles.push(converted)
  }
}
```

**利点**:
- **データ保全**: 既存スプールファイルを破棄せず保持
- **自動変換**: 読み込み時に自動で新形式へ変換
- **ダウンタイム不要**: マイグレーションスクリプト不要
- **段階的移行**: 新形式と旧形式を並行運用
- **ロールバック可能**: 旧バージョンへ戻しても旧形式スプールファイルが残る

**欠点**:
- **変換コストの発生**: 読み込み毎に変換処理が実行される（ただし1回のみ、再保存後は新形式）
- **コードの複雑化**: 旧形式・新形式両方のスキーマ定義が必要

### 採用理由

**読み込み時に変換（選択肢3）を採用する理由**:

1. **データ保全の最優先**
   - 既存スプールファイルを破棄せず、送信機会を維持
   - 監査証跡を保持し、トラブルシューティングが可能
   - ユーザーへのデータ欠損を防止

2. **ダウンタイム不要**
   - マイグレーションスクリプト不要で、デプロイ後即座に動作
   - 段階的移行により、運用リスクを最小化
   - 新規スプールファイルは新形式で保存、旧形式は読み込み時のみ変換

3. **変換失敗の局所化**
   - 変換失敗時は該当ファイルのみ`data/failed/`へ移動
   - 他のスプールファイルに影響を与えない
   - エラーログで変換失敗の理由を追跡可能

4. **ロールバック可能性**
   - 旧バージョンへロールバック時も、旧形式スプールファイルが残る
   - 新バージョンでの動作確認後、旧形式スプールファイルを削除可能

5. **provider/modelの欠損対応**
   - 旧形式にはprovider/model情報が含まれないが、"unknown"で送信
   - API_Meter側で"unknown"を受け入れる仕様（要件4-B）に準拠
   - 将来的に旧形式スプールファイルが消滅すれば、変換ロジックも削除可能

## 影響

### ポジティブな影響

- **データ保全**: 既存スプールファイルを破棄せず、送信機会を維持
- **自動移行**: 読み込み時に自動で新形式へ変換、手動作業不要
- **ダウンタイム不要**: マイグレーションスクリプト不要で、デプロイ後即座に動作
- **ロールバック可能**: 旧バージョンへ戻しても旧形式スプールファイルが残る
- **段階的移行**: 新形式と旧形式を並行運用、リスクを最小化

### ネガティブな影響

- **変換コスト**: 読み込み毎に変換処理が実行される（ただし1回のみ、再保存後は新形式）
- **コードの複雑化**: 旧形式・新形式両方のスキーマ定義が必要
- **provider/model情報の欠損**: 旧形式スプールファイルは"unknown"で送信
- **学習コスト**: 開発者が変換ロジックを理解する必要

### 中立的な影響

- **並行運用期間**: 旧形式スプールファイルが消滅するまで変換ロジックが必要
- **削除タイミング**: 旧形式スプールファイルが全て送信完了後、変換ロジックを削除可能
- **監視**: 旧形式スプールファイルの変換回数を監視（異常に多い場合は調査）

## 実装への指針

### 原則

1. **旧形式スキーマの定義**
   - `src/types/spool.ts`に`legacySpoolFileSchema`を定義
   - `LegacySpoolFile`型をエクスポート

2. **変換関数の実装**
   - `convertLegacySpoolFile()`関数を`src/sender/spool-manager.ts`に実装
   - 変換失敗時はnullを返し、エラーログを出力

3. **読み込み時の自動変換**
   - `SpoolManager.listSpoolFiles()`で旧形式を検出
   - 新形式バリデーション失敗時、旧形式バリデーションを試行
   - 旧形式成功時は変換関数を呼び出し、新形式へ変換

4. **欠損データの対応**
   - provider/modelは"unknown"を設定
   - input_tokens/output_tokensは0を設定
   - request_countは1を設定（推定値）
   - metadata.aggregation_methodは"legacy_conversion"を設定

5. **変換失敗時の処理**
   - 両形式でバリデーション失敗時は`data/failed/`へ移動
   - エラーログで変換失敗の理由を詳細に記録

6. **テスト戦略**
   - 旧形式スプールファイルの変換テスト
   - 変換失敗時のエラーハンドリングテスト
   - 新形式スプールファイルの読み込みテスト
   - 並行運用時の統合テスト

7. **監視とアラート**
   - 旧形式スプールファイルの変換回数を監視
   - 変換失敗の頻度を追跡
   - `data/failed/`へ移動したファイル数を監視

8. **変換ロジックの削除タイミング**
   - 旧形式スプールファイルが全て送信完了後
   - `data/spool/`配下に旧形式ファイルが残っていないことを確認
   - 変換ロジックとlegacySpoolFileSchemaを削除

## 参考資料

- [Schema Evolution Best Practices](https://martinfowler.com/articles/evolvingPublishedInterfaces.html) - スキーマ進化のベストプラクティス
- [Data Migration Strategies](https://www.thoughtworks.com/insights/blog/evolutionary-database-design) - データマイグレーション戦略
- [Zod Schema Validation](https://zod.dev/) - zodスキーマバリデーション

## 関連情報

- **関連ADR**:
  - ADR 001: スプールファイル形式（既存スプール機構の定義）
  - ADR 014: 型システムの完全置き換え（新形式の型定義）
  - ADR 016: 冪等性機構（source_event_id生成ロジック）
  - ADR 017: エラーハンドリング戦略（リトライ上限到達時のスプール保存）
