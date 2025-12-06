---
id: 019
feature: api-meter-interface-migration
type: adr
version: 1.0.0
created: 2025-12-04
based_on: requirements analysis for API_Meter new specification
---

# ADR 019: 日別集計の実装

## ステータス

Proposed

## コンテキスト

API_Meterの新仕様（2025-12-04版）では、データ送信粒度が**日別（daily）**に固定された。既存のdify-usage-exporterは月別・週別・日別の3つの集計周期をサポートしているが、API_Meterへの送信は日別データのみを対象とする。

### 既存の集計周期（ADR 010）

```typescript
// src/types/env.ts
export type AggregationPeriod = 'monthly' | 'weekly' | 'daily'

// 集計結果
export interface AggregatedModelRecord {
  period: string // 'YYYY-MM'（月）, 'YYYY-Www'（週）, 'YYYY-MM-DD'（日）
  period_type: AggregationPeriod
  // ...
}
```

- **monthly**: 1ヶ月分を1レコードに集約（例: 2025-11）
- **weekly**: 1週間分を1レコードに集約（例: 2025-W48）
- **daily**: 1日分を1レコードに集約（例: 2025-11-29）

### 新仕様の要求（REQ-007, REQ-008）

```json
{
  "tenant_id": "UUID",
  "export_metadata": {
    "aggregation_period": "daily",
    "date_range": {
      "start": "2025-11-29T00:00:00.000Z",
      "end": "2025-11-29T23:59:59.999Z"
    }
  },
  "records": [{
    "usage_date": "2025-11-29",
    // ...
  }]
}
```

- **aggregation_period**: "daily"固定
- **1日1レコード**: 同一日のデータは1レコードに集約
- **日付範囲**: start/endで1日の開始・終了時刻を指定（UTC）

### 冪等性の仕組み（API_Meterチーム確認済み）

API_Meterの冪等性は**リクエスト全体ではなく、各レコード単位**で保証される（2025-12-04確認）：

**冪等性キー**: `(tenant_id, provider_id, model_id, usage_date)`

- この4つのフィールドの組み合わせでUNIQUE制約を設定
- 同じ冪等性キーのレコードを再送すると、`ON CONFLICT DO UPDATE`で**上書き**
- **常に200 OKを返す**（409 Conflictは返さない）
  - 初回送信（INSERT）→ 200 OK (inserted=1, updated=0)
  - 再送信（UPDATE）→ 200 OK (inserted=0, updated=1)
- **source_event_id**はトレーサビリティ専用メタデータ（冪等性判定には使用しない）
  - 異なるsource_event_idで再送しても、冪等性キーが同じなら上書き

### 制約事項

- **日別データのみ送信**: 月別・週別データはAPI_Meterへ送信しない
- **集計周期の選択肢維持**: 既存のDIFY_AGGREGATION_PERIOD環境変数は保持（ローカル集計用）
- **冪等性の保証**: 同一日のデータを複数回送信しても、API_Meter側で上書き

## 決定事項

### 1. aggregation_periodは"daily"固定

API_Meterへの送信時、export_metadataのaggregation_periodは常に"daily"を設定：

```typescript
// src/transformer/data-transformer.ts
export function createDataTransformer(deps: TransformerDeps): ITransformer {
  return {
    transform(records: NormalizedModelRecord[]): TransformResult {
      const apiMeterRequest: ApiMeterRequest = {
        tenant_id: deps.config.API_METER_TENANT_ID,
        export_metadata: {
          exporter_version: '1.1.0',
          export_timestamp: getCurrentISOTimestamp(),
          aggregation_period: 'daily', // 固定値
          date_range: {
            start: getDateRangeStart(records),
            end: getDateRangeEnd(records),
          },
        },
        records: records.map(record => ({
          usage_date: record.period, // YYYY-MM-DD形式
          provider: record.model_provider,
          model: record.model_name,
          input_tokens: record.prompt_tokens,
          output_tokens: record.completion_tokens,
          total_tokens: record.total_tokens,
          request_count: record.execution_count,
          cost_actual: parseFloat(record.total_price),
          currency: record.currency,
          metadata: {
            source_system: 'dify',
            source_event_id: generateSourceEventId({
              usage_date: record.period,
              provider: record.model_provider,
              model: record.model_name,
              app_id: record.app_id,
              user_id: record.user_id,
            }),
            source_app_id: record.app_id,
            source_app_name: record.app_name,
            aggregation_method: 'daily_sum',
          },
        })),
      }

      return {
        request: apiMeterRequest,
        successCount: records.length,
        errorCount: 0,
        errors: [],
      }
    }
  }
}
```

### 2. 日付範囲の計算

```typescript
// src/transformer/data-transformer.ts

/**
 * レコード群から日付範囲の開始時刻を取得
 * usage_dateの最小値を1日の開始時刻（00:00:00.000Z）に変換
 */
function getDateRangeStart(records: NormalizedModelRecord[]): string {
  if (records.length === 0) {
    throw new Error('No records provided for date range calculation')
  }

  const dates = records.map(r => new Date(r.period))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))

  // 1日の開始時刻（UTC）
  minDate.setUTCHours(0, 0, 0, 0)
  return minDate.toISOString()
}

/**
 * レコード群から日付範囲の終了時刻を取得
 * usage_dateの最大値を1日の終了時刻（23:59:59.999Z）に変換
 */
function getDateRangeEnd(records: NormalizedModelRecord[]): string {
  if (records.length === 0) {
    throw new Error('No records provided for date range calculation')
  }

  const dates = records.map(r => new Date(r.period))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

  // 1日の終了時刻（UTC）
  maxDate.setUTCHours(23, 59, 59, 999)
  return maxDate.toISOString()
}
```

### 3. 日別データの送信フロー

```
Fetch → Aggregate(daily) → Normalize → Transform → Send
  ↓           ↓                ↓          ↓          ↓
Dify API   日別集計         正規化    日別形式   API_Meter
                                      ↓
                                aggregation_period: "daily"
                                usage_date: YYYY-MM-DD
```

### 4. 月別・週別データの扱い

DIFY_AGGREGATION_PERIODが"monthly"または"weekly"の場合：

```typescript
// src/index.ts
const aggregationResult = aggregateUsageData(
  rawRecords,
  config.DIFY_AGGREGATION_PERIOD, // monthly/weekly/daily
  config.DIFY_OUTPUT_MODE,
  rawUserRecords,
  rawModelRecords
)

// API_Meterへは日別データのみ送信
if (config.DIFY_OUTPUT_MODE === 'per_model' || config.DIFY_OUTPUT_MODE === 'all') {
  // 日別データのみをフィルタ
  const dailyRecords = aggregationResult.modelRecords.filter(
    record => record.period_type === 'daily'
  )

  if (dailyRecords.length > 0) {
    const normalizedRecords = normalizer.normalizeRecords(dailyRecords)
    const transformResult = transformer.transform(normalizedRecords)
    await sender.send(transformResult)
  } else {
    logger.warn('No daily records for API_Meter', {
      aggregationPeriod: config.DIFY_AGGREGATION_PERIOD,
    })
  }
}
```

**重要**: DIFY_AGGREGATION_PERIODが"monthly"または"weekly"の場合、API_Meterへの送信はスキップされる。

### 5. 集計周期の優先順位

| DIFY_AGGREGATION_PERIOD | ローカル集計 | API_Meter送信 | 理由 |
|------------------------|-----------|-------------|------|
| daily | 日別 | 送信する | 新仕様に準拠 |
| weekly | 週別 | 送信しない | 日別データがないため |
| monthly | 月別 | 送信しない | 日別データがないため |

**推奨設定**: DIFY_AGGREGATION_PERIOD="daily"を推奨（API_Meter送信を有効化）

### 6. 同日データの再送（冪等性）

**API_Meterチームからの確認（2025-12-04）**:

API_Meterの冪等性メカニズムは以下の通り：

- **冪等性キー**: `(tenant_id, provider_id, model_id, usage_date)`
  - この4つのフィールドの組み合わせでUNIQUE制約
- **動作**: 同じusage_dateのレコードを再送すると、`ON CONFLICT DO UPDATE`で**上書き**
- **レスポンス**: 常に`200 OK`を返す（409 Conflictは返さない）
  - 初回送信（INSERT）→ 200 OK
  - 再送信（UPDATE）→ 200 OK
- **source_event_id**: トレーサビリティ専用（冪等性判定には使用しない）
  - 異なるsource_event_idで再送しても、冪等性キーが同じなら上書き

**レスポンス例**:
```json
{
  "success": true,
  "processed_records": 1,
  "inserted": 0,  // UPDATEの場合は0
  "updated": 1    // UPDATEの場合は1
}
```

**例**: 2025-11-29のデータを2回送信

1回目送信:
```json
{
  "usage_date": "2025-11-29",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "total_tokens": 15000,
  "cost_actual": 0.105,
  "metadata": { "source_event_id": "abc123" }
}
```
レスポンス: `200 OK` (inserted=1, updated=0)

2回目送信（同じusage_date、異なるsource_event_id）:
```json
{
  "usage_date": "2025-11-29",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "total_tokens": 20000,
  "cost_actual": 0.140,
  "metadata": { "source_event_id": "def456" }
}
```
レスポンス: `200 OK` (inserted=0, updated=1)

**結果**: API_Meter側で2回目のデータで上書き（total_tokens: 20000, cost_actual: 0.140, source_event_id: "def456"）

## 根拠

### 検討した選択肢

#### 1. aggregation_periodを環境変数で指定（非推奨）

```typescript
// 環境変数でaggregation_periodを指定
export_metadata: {
  aggregation_period: config.API_METER_AGGREGATION_PERIOD, // 環境変数
  // ...
}
```

**利点**:
- 柔軟性が高い（将来的にAPI_Meterが週別・月別をサポートした場合に対応可能）

**欠点**:
- **API_Meter仕様との不一致**: 現仕様では日別のみサポート
- **設定ミス**: 誤って"weekly"/"monthly"を設定すると送信エラー
- **複雑性の増加**: 環境変数が増え、設定が煩雑になる
- **YAGNI原則違反**: 将来の拡張性を優先し、現在の要件を複雑化

#### 2. 月別・週別データを日別に分割して送信（非推奨）

```typescript
// 月別データ（2025-11）を日別に分割
const dailyRecords = splitMonthlyToDaily(monthlyRecord)
// 30日分のレコードを生成して送信
```

**利点**:
- DIFY_AGGREGATION_PERIODが"monthly"/"weekly"でもAPI_Meterへ送信可能

**欠点**:
- **データ精度の損失**: 月別データを均等分割すると、実際の日別使用量と乖離
- **source_event_idの不整合**: 分割後のレコード毎に異なるsource_event_idを生成する必要
- **複雑な実装**: 分割ロジックが複雑で、バグの温床
- **API_Meterの意図に反する**: API_Meterは実際の日別データを期待

#### 3. aggregation_periodを"daily"固定、日別データのみ送信（採用）

```typescript
// aggregation_periodを"daily"固定
export_metadata: {
  aggregation_period: 'daily',
  // ...
}

// 日別データのみをフィルタして送信
const dailyRecords = aggregationResult.modelRecords.filter(
  record => record.period_type === 'daily'
)
```

**利点**:
- **API_Meter仕様に完全準拠**: 日別データのみ送信
- **シンプルな実装**: aggregation_periodを"daily"固定、条件分岐が少ない
- **データ精度の保証**: 実際の日別使用量を送信
- **冪等性の保証**: usage_dateで一意に識別、同日データの再送時は上書き
- **環境変数の削減**: API_METER_AGGREGATION_PERIOD環境変数が不要

**欠点**:
- **月別・週別データの送信不可**: DIFY_AGGREGATION_PERIOD="monthly"/"weekly"の場合、API_Meterへ送信されない
- **設定の推奨**: DIFY_AGGREGATION_PERIOD="daily"を推奨する必要

### 採用理由

**aggregation_periodを"daily"固定（選択肢3）を採用する理由**:

1. **API_Meter仕様への完全準拠**
   - 新仕様では日別データのみをサポート
   - aggregation_period: "daily"が必須
   - 週別・月別データは受け入れられない

2. **データ精度の保証**
   - 実際の日別使用量を送信
   - 月別データを分割する必要がなく、データ精度が保たれる
   - usage_dateで一意に識別され、冪等性が保証される

3. **シンプルな実装**
   - aggregation_periodを"daily"固定、条件分岐が少ない
   - 環境変数の追加が不要（API_METER_AGGREGATION_PERIOD不要）
   - YAGNI原則に従い、現在の要件のみを実装

4. **冪等性の保証**
   - (tenant_id, provider_id, model_id, usage_date)で一意に識別
   - 同日データの再送時は、API_Meter側で`ON CONFLICT DO UPDATE`により上書き
   - **常に200 OKを返す**（409 Conflictは返さない）
   - レスポンスボディの`inserted`/`updated`でINSERT/UPDATEを判別可能

5. **運用のシンプル化**
   - DIFY_AGGREGATION_PERIOD="daily"を推奨
   - 設定ミスによる送信エラーを防止
   - 月別・週別データが必要な場合は、ローカル集計のみ実行

## 影響

### ポジティブな影響

- **API_Meter仕様への完全準拠**: 日別データのみ送信、仕様違反なし
- **データ精度の保証**: 実際の日別使用量を送信、データ精度が保たれる
- **冪等性の保証**: usage_dateで一意に識別、同日データの再送時は上書き
- **シンプルな実装**: aggregation_periodを"daily"固定、条件分岐が少ない
- **環境変数の削減**: API_METER_AGGREGATION_PERIOD環境変数が不要

### ネガティブな影響

- **月別・週別データの送信不可**: DIFY_AGGREGATION_PERIOD="monthly"/"weekly"の場合、API_Meterへ送信されない
- **設定の推奨**: DIFY_AGGREGATION_PERIOD="daily"を推奨する必要
- **警告ログの出力**: 月別・週別データ使用時に警告ログが出力される

### 中立的な影響

- **DIFY_AGGREGATION_PERIODの継続使用**: ローカル集計用に環境変数を保持
- **ローカル集計と送信の分離**: ローカル集計は月別・週別可能、送信は日別のみ
- **学習コスト**: 開発者が「ローカル集計」と「API_Meter送信」の違いを理解する必要

## 実装への指針

### 原則

1. **aggregation_periodは"daily"固定**
   - export_metadata.aggregation_periodは常に"daily"を設定
   - 環境変数での指定は不要

2. **日別データのみ送信**
   - aggregationResult.modelRecordsから、period_type === 'daily'のレコードのみをフィルタ
   - 月別・週別データはAPI_Meterへ送信しない

3. **日付範囲の計算**
   - date_range.startはusage_dateの最小値を1日の開始時刻（00:00:00.000Z）に変換
   - date_range.endはusage_dateの最大値を1日の終了時刻（23:59:59.999Z）に変換

4. **usage_dateのフォーマット**
   - YYYY-MM-DD形式（ISO 8601準拠）
   - UTC時刻で統一

5. **冪等性の保証**
   - (tenant_id, provider_id, model_id, usage_date)で一意に識別
   - 同日データの再送時は、API_Meter側で`ON CONFLICT DO UPDATE`により上書き
   - **常に200 OKを返す**（409 Conflictは返さない）
   - source_event_idはトレーサビリティ専用（冪等性判定には使用しない）
   - 異なるsource_event_idで再送しても、冪等性キーが同じなら上書き

6. **警告ログの出力**
   - DIFY_AGGREGATION_PERIOD="monthly"/"weekly"の場合、警告ログを出力
   - 「日別データがないため、API_Meterへ送信されません」とメッセージ表示

7. **テスト戦略**
   - aggregation_period="daily"の送信テスト
   - 日付範囲の計算テスト
   - usage_dateのフォーマットテスト
   - 月別・週別データのフィルタリングテスト
   - 同日データの再送テスト（冪等性確認）

8. **推奨設定**
   - DIFY_AGGREGATION_PERIOD="daily"を推奨
   - README.mdに設定ガイドを記載

## 参考資料

- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601) - 日付フォーマットの標準仕様
- [Idempotency in REST APIs](https://restfulapi.net/idempotency/) - RESTful APIの冪等性設計
- [Time Range Representation](https://www.ietf.org/rfc/rfc3339.txt) - 日付範囲の表現形式（RFC 3339）

## 関連情報

- **関連ADR**:
  - ADR 010: データ変換アーキテクチャ（集計周期の定義）
  - ADR 014: 型システムの完全置き換え（ApiMeterRequestの構造）
  - ADR 016: 冪等性機構（source_event_id生成ロジック）
  - ADR 017: エラーハンドリング戦略（409 Conflictの扱い）
