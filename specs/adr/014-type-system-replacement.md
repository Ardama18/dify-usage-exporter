---
id: 014
feature: api-meter-interface-migration
type: adr
version: 1.0.0
created: 2025-12-04
based_on: requirements analysis for API_Meter new specification
---

# ADR 014: 型システムの完全置き換え

## ステータス

Accepted

- Date: 2025-12-06
- Implemented in: v1.1.0

## コンテキスト

API_Meterの新仕様（2025-12-04版）では、外部APIへ送信するデータ構造が大幅に変更された。既存の`ExternalApiRecord`型は新仕様と完全に不一致であり、以下の問題がある：

### 既存型の定義（src/types/external-api.ts）

```typescript
export const externalApiRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  app_id: z.string().min(1),
  app_name: z.string().min(1),
  token_count: z.number().int().min(0),
  total_price: z.string(),
  currency: z.string().default('USD'),
  idempotency_key: z.string().min(1),
  transformed_at: z.string().datetime(),
})
```

### 新仕様の要求（API_Meter 2025-12-04版）

```json
{
  "tenant_id": "UUID",
  "export_metadata": {
    "exporter_version": "1.1.0",
    "export_timestamp": "ISO8601",
    "aggregation_period": "daily",
    "date_range": { "start": "ISO8601", "end": "ISO8601" }
  },
  "records": [{
    "usage_date": "YYYY-MM-DD",
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
      "source_app_id": "abc123-def456-789",
      "source_app_name": "FAQ Bot",
      "aggregation_method": "daily_sum",
      "time_range": { "start": "ISO8601", "end": "ISO8601" }
    }
  }]
}
```

### 主要な不一致

1. **トップレベル構造**: バッチ単位ではなく、tenant_id + export_metadata + recordsの階層構造
2. **フィールド名**: date → usage_date, token_count → input_tokens/output_tokens/total_tokens
3. **新規必須フィールド**: provider, model, request_count, cost_actual
4. **メタデータの移動**: source_system, source_event_idがmetadata内に移動
5. **冪等キーの扱い**: batchIdempotencyKeyはトップレベル削除、source_event_idへ移行

### 影響範囲

既存の`ExternalApiRecord`型は以下のファイルで使用されている：

- `src/types/external-api.ts`: 型定義
- `src/transformer/data-transformer.ts`: 変換処理
- `src/sender/external-api-sender.ts`: 送信処理
- `src/sender/spool-manager.ts`: スプールファイル保存
- `src/types/spool.ts`: スプールファイル型定義
- `test/unit/transformer/data-transformer.test.ts`: テストコード
- `test/unit/types/external-api.test.ts`: テストコード

## 決定事項

### 1. ExternalApiRecordを非推奨とし、ApiMeterUsageRecordに全面移行

既存型を段階的に拡張するのではなく、新型を導入して完全に置き換える。

### 2. 新型の定義

```typescript
// src/types/api-meter-schema.ts（新規ファイル）

// トップレベルリクエスト
export const apiMeterRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  export_metadata: z.object({
    exporter_version: z.string().default('1.1.0'),
    export_timestamp: z.string().datetime(),
    aggregation_period: z.enum(['daily', 'weekly', 'monthly']),
    date_range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }),
  }),
  records: z.array(apiMeterUsageRecordSchema),
})

// レコード（個別）
export const apiMeterUsageRecordSchema = z.object({
  usage_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: z.string().min(1),
  model: z.string().min(1),
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  request_count: z.number().int().min(0),
  cost_actual: z.number().min(0),
  currency: z.string().default('USD'),
  metadata: z.object({
    source_system: z.literal('dify'),
    source_event_id: z.string().min(1),
    source_app_id: z.string().optional(),
    source_app_name: z.string().optional(),
    aggregation_method: z.string().default('daily_sum'),
    time_range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
  }),
})

export type ApiMeterRequest = z.infer<typeof apiMeterRequestSchema>
export type ApiMeterUsageRecord = z.infer<typeof apiMeterUsageRecordSchema>
```

### 3. 型の移行戦略

**Phase 1: 新型の導入**
- `src/types/api-meter-schema.ts`を新規作成
- zodスキーマとTypeScript型を定義

**Phase 2: 変換層の更新**
- `src/transformer/data-transformer.ts`を`ApiMeterUsageRecord`型に対応
- 既存の`ExternalApiRecord`型を使用する箇所をすべて置き換え

**Phase 3: 送信層の更新**
- `src/sender/external-api-sender.ts`を`ApiMeterRequest`型に対応
- HTTPクライアントのリクエストボディを新形式に変更

**Phase 4: スプール機構の更新**
- `src/types/spool.ts`を`ApiMeterRequest`型に対応
- 既存スプールファイルの変換ロジックを追加（ADR 018参照）

**Phase 5: 旧型の削除**
- `src/types/external-api.ts`のExternalApiRecordを削除
- 関連するテストコードを更新

### 4. 環境変数の追加

```typescript
// src/types/env.ts
export const envSchema = z.object({
  // 既存の環境変数...

  // API_Meter関連（新規）
  API_METER_TENANT_ID: z.string().uuid(),
  API_METER_TOKEN: z.string().min(1),
  API_METER_URL: z.string().url(),
})
```

### 5. バリデーション強化

```typescript
// total_tokensの検証（REQ-003）
.refine(
  (data) => data.total_tokens === data.input_tokens + data.output_tokens,
  {
    message: 'total_tokens must equal input_tokens + output_tokens',
    path: ['total_tokens'],
  }
)
```

## 根拠

### 検討した選択肢

#### 1. 既存型を拡張（非推奨）

```typescript
// 既存のExternalApiRecordを拡張
export const externalApiRecordSchema = z.object({
  // 既存フィールド（後方互換性のため残す）
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  app_id: z.string().min(1),
  app_name: z.string().min(1),

  // 新規フィールド
  usage_date: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  // ...
})
```

**利点**:
- 既存コードとの互換性維持
- 段階的な移行が可能

**欠点**:
- **型の肥大化**: 旧フィールドと新フィールドが混在し、どちらを使用すべきか不明
- **バリデーションの複雑化**: optionalフィールドが増え、どの組み合わせが有効か判断困難
- **保守性の低下**: 旧仕様と新仕様が混在し、将来的なリファクタリングが困難
- **テストの複雑化**: 旧型・新型両方のパターンをテストする必要がある
- **ドキュメント不整合**: 型定義と実際の使用が乖離

#### 2. 新型を追加し段階的移行（非推奨）

```typescript
// 旧型（deprecated）
export type ExternalApiRecord = z.infer<typeof externalApiRecordSchema>

// 新型
export type ApiMeterUsageRecord = z.infer<typeof apiMeterUsageRecordSchema>
```

**利点**:
- 並行運用期間を設けられる
- 既存機能を破壊しない

**欠点**:
- **並行期間の保守負担**: 2つの型を同時にメンテナンス
- **データフロー分岐**: 旧型用と新型用の処理を両方維持
- **スプール機構の複雑化**: 旧形式と新形式の両方を扱う必要
- **終了時期の曖昧さ**: 並行運用をいつ終了するか判断が困難
- **テストの二重管理**: 旧型・新型両方のテストケースを維持

#### 3. 完全置き換え（採用）

```typescript
// src/types/api-meter-schema.ts（新規ファイル）
export type ApiMeterRequest = z.infer<typeof apiMeterRequestSchema>
export type ApiMeterUsageRecord = z.infer<typeof apiMeterUsageRecordSchema>

// src/types/external-api.ts（削除予定）
// @deprecated Use ApiMeterUsageRecord from api-meter-schema.ts
export type ExternalApiRecord = z.infer<typeof externalApiRecordSchema>
```

**利点**:
- **型の明確性**: 新仕様に完全に準拠した型定義
- **保守性**: 旧型を残さず、メンテナンス対象が単一
- **テストの簡素化**: 新型のみをテスト
- **ドキュメント一貫性**: 型定義とAPI仕様が完全に一致
- **将来的な拡張性**: 新仕様に基づく拡張が容易

**欠点**:
- **一時的な破壊**: 既存コードの広範囲な変更が必要
- **マイグレーション作業**: スプールファイル変換ロジックが必要（ADR 018で対応）
- **実装コスト**: 全ての関連ファイルを同時に更新

### 採用理由

**完全置き換え（選択肢3）を採用する理由**:

1. **新仕様との完全な互換性**
   - API_Meter新仕様（2025-12-04版）と100%一致する型定義
   - フィールド名、型、バリデーションルールが仕様書と同一

2. **長期的な保守性の向上**
   - 旧型を残さないため、将来的な保守負担が最小
   - 新規開発者が混乱しない（使用すべき型が明確）
   - ドキュメントと実装の乖離を防止

3. **テストの簡素化**
   - 新型のみをテストすれば良い
   - 旧型との互換性テストが不要
   - テストケースの重複を排除

4. **スプール機構との整合性**
   - ADR 018で既存スプールファイルの変換を実施
   - 変換後は新型のみを扱うため、スプール機構がシンプル化

5. **一時的な破壊の受容**
   - 破壊的変更だが、影響範囲が明確（8-10ファイル）
   - リファクタリング完了後は負債が残らない
   - 段階的移行による並行運用期間の負債を回避

6. **実装規模の現実性**
   - 影響ファイル数は8-10ファイルで管理可能
   - 並行運用期間を設けるコストより、一括変更のコストが低い

## 影響

### ポジティブな影響

- **型安全性の向上**: zodスキーマで厳密なバリデーション
- **API仕様との完全一致**: ドキュメントと実装の乖離が解消
- **保守性の向上**: 単一の型システムで保守負担が軽減
- **テストの簡素化**: 新型のみをテスト
- **将来的な拡張性**: 新仕様に基づく機能追加が容易

### ネガティブな影響

- **大規模な変更**: 8-10ファイルの同時変更が必要
- **マイグレーション作業**: 既存スプールファイルの変換が必要（ADR 018）
- **一時的な破壊**: 既存の型を使用する全コードが影響
- **テストの全面改修**: 既存テストケースを新型に対応

### 中立的な影響

- **環境変数の追加**: API_METER_TENANT_ID, API_METER_TOKEN, API_METER_URLが必須
- **学習コスト**: 新型の構造を理解する必要（ただしAPI仕様と一致するため学習は容易）

## 実装への指針

### 原則

1. **zodスキーマによるバリデーション**
   - すべてのフィールドでzodスキーマを定義
   - runtime validationで型安全性を保証
   - refineメソッドでカスタムバリデーション（total_tokens検証等）

2. **段階的な実装（Phase分け）**
   - Phase 1-5に従って順次実装
   - 各Phaseでテストを実施し、動作確認

3. **型のエクスポート**
   - ApiMeterRequest, ApiMeterUsageRecordを`src/types/api-meter-schema.ts`からエクスポート
   - 既存のExternalApiRecordには`@deprecated`コメントを付与

4. **バリデーションエラーのハンドリング**
   - zodのsafeParse()を使用し、バリデーションエラーを詳細にログ出力
   - バリデーション失敗時は変換エラーとして処理（TransformError配列に追加）

5. **テスト戦略**
   - 新型のzodスキーマに対するユニットテスト作成
   - total_tokensの検証ロジックをテスト
   - 変換層のテストを新型に対応

6. **マイグレーション**
   - 既存スプールファイルは旧形式のまま保持
   - SpoolManager読み込み時に新形式へ変換（ADR 018参照）

## 参考資料

- [Zod Documentation](https://zod.dev/) - TypeScriptファーストのスキーマバリデーションライブラリ
- [API Versioning Best Practices](https://www.freecodecamp.org/news/rest-api-design-best-practices-build-a-rest-api/) - REST API設計とバージョン管理のベストプラクティス
- [TypeScript Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - 型の絞り込みとランタイムバリデーション

## 関連情報

- **関連ADR**:
  - ADR 010: データ変換アーキテクチャ（変換層の責務定義）
  - ADR 013: 正規化層の導入（正規化後の型定義）
  - ADR 016: 冪等性機構（source_event_id生成ロジック）
  - ADR 018: スプール機構統合（旧形式スプールファイルの変換）
