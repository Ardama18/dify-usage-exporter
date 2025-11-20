# Shared モジュール

このドキュメントは、frontend/backend で共通利用する型定義・モデルの管理方針を定義します。

## 目的

- **型定義の一元管理**: frontend/backend での型定義の二重管理を防ぐ
- **型安全性の向上**: TypeScript strict mode による厳密な型チェック
- **開発効率の向上**: 変更時の修正箇所を一箇所に集約
- **一貫性の確保**: API の Request/Response 型を共有することで整合性を保つ

## ディレクトリ構造

```
shared/
├── types/
│   ├── src/
│   │   ├── index.ts          # エクスポートのエントリーポイント
│   │   ├── debtor.ts         # 債務者関連の型定義
│   │   ├── scenario.ts       # シナリオ関連の型定義
│   │   ├── reminder.ts       # 督促履歴関連の型定義
│   │   └── common.ts         # 共通型定義
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## 型定義の指針

### 1. エンティティ型 (Entities)

データベースモデルに対応する型定義

```typescript
// shared/types/src/debtor.ts

/**
 * 債務者エンティティ
 */
export interface Debtor {
  id: string
  name: string
  email: string
  phone: string
  debtAmount: number
  status: DebtorStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * 債務者のステータス
 */
export type DebtorStatus = 'active' | 'inactive' | 'paid' | 'defaulted'

/**
 * 債務者作成用の型 (IDとタイムスタンプを除く)
 */
export type CreateDebtorInput = Omit<Debtor, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 債務者更新用の型 (部分的な更新を許可)
 */
export type UpdateDebtorInput = Partial<CreateDebtorInput>
```

### 2. リクエスト/レスポンス型

API通信で使用する型定義

```typescript
// shared/types/src/debtor.ts (続き)

/**
 * 債務者一覧取得のレスポンス
 */
export interface GetDebtorsResponse {
  debtors: Debtor[]
  total: number
  page: number
  pageSize: number
}

/**
 * 債務者一覧取得のクエリパラメータ
 */
export interface GetDebtorsQuery {
  page?: number
  pageSize?: number
  status?: DebtorStatus
  search?: string
}

/**
 * 債務者作成のレスポンス
 */
export interface CreateDebtorResponse {
  debtor: Debtor
}

/**
 * 債務者作成のリクエスト
 */
export interface CreateDebtorRequest {
  name: string
  email: string
  phone: string
  debtAmount: number
  status: DebtorStatus
}
```

### 3. ドメイン型

ビジネスロジックで使用する型定義

```typescript
// shared/types/src/scenario.ts

/**
 * シナリオエンティティ
 */
export interface Scenario {
  id: string
  name: string
  description?: string
  steps: ScenarioStep[]
  createdAt: Date
  updatedAt: Date
}

/**
 * シナリオのステップ
 */
export interface ScenarioStep {
  id: string
  order: number
  type: ScenarioStepType
  config: ScenarioStepConfig
}

/**
 * ステップタイプ
 */
export type ScenarioStepType = 'email' | 'sms' | 'call' | 'wait'

/**
 * ステップ設定 (型によって異なる)
 */
export type ScenarioStepConfig =
  | EmailStepConfig
  | SmsStepConfig
  | CallStepConfig
  | WaitStepConfig

export interface EmailStepConfig {
  subject: string
  body: string
  template?: string
}

export interface SmsStepConfig {
  message: string
  template?: string
}

export interface CallStepConfig {
  script: string
}

export interface WaitStepConfig {
  days: number
}
```

### 4. 共通型

アプリケーション全体で使用する汎用的な型定義

```typescript
// shared/types/src/common.ts

/**
 * ページネーション情報
 */
export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * ページネーション付きレスポンス
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

/**
 * APIエラーレスポンス
 */
export interface ApiError {
  statusCode: number
  message: string
  error?: string
  timestamp: string
}

/**
 * 成功レスポンス
 */
export interface ApiSuccess<T = void> {
  success: true
  data?: T
  message?: string
}

/**
 * IDを持つオブジェクト
 */
export interface WithId {
  id: string
}

/**
 * タイムスタンプを持つオブジェクト
 */
export interface WithTimestamps {
  createdAt: Date
  updatedAt: Date
}

/**
 * ソート順
 */
export type SortOrder = 'asc' | 'desc'

/**
 * ソート設定
 */
export interface SortConfig<T> {
  field: keyof T
  order: SortOrder
}
```

### 5. エクスポートの集約

```typescript
// shared/types/src/index.ts

// 債務者関連
export * from './debtor'

// シナリオ関連
export * from './scenario'

// 督促履歴関連
export * from './reminder'

// 共通型
export * from './common'
```

## パッケージ設定

### package.json
```json
{
  "name": "@debt-collect-robo/shared-types",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## Frontend での使用

### インポート
```typescript
// frontend/components/features/debtor/DebtorList.tsx
import type { Debtor, GetDebtorsResponse } from '@/shared/types'

interface DebtorListProps {
  debtors: Debtor[]
}

export function DebtorList({ debtors }: DebtorListProps) {
  // ...
}
```

### APIクライアント
```typescript
// frontend/lib/api-client.ts
import type {
  Debtor,
  CreateDebtorRequest,
  CreateDebtorResponse
} from '@/shared/types'

export async function createDebtor(
  data: CreateDebtorRequest
): Promise<CreateDebtorResponse> {
  const response = await fetch('/api/debtors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return response.json()
}
```

## Backend での使用

### DTO への変換
```typescript
// backend/src/modules/debtors/dto/create-debtor.dto.ts
import { IsString, IsEmail, IsNumber, Min, IsEnum } from 'class-validator'
import type { CreateDebtorRequest, DebtorStatus } from '@/shared/types'

export class CreateDebtorDto implements CreateDebtorRequest {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  phone: string

  @IsNumber()
  @Min(0)
  debtAmount: number

  @IsEnum(['active', 'inactive', 'paid', 'defaulted'])
  status: DebtorStatus
}
```

### Service での使用
```typescript
// backend/src/modules/debtors/debtors.service.ts
import type { Debtor, CreateDebtorInput } from '@/shared/types'

@Injectable()
export class DebtorsService {
  async create(input: CreateDebtorInput): Promise<Debtor> {
    return this.prisma.debtor.create({
      data: input,
    })
  }
}
```

## 型定義のベストプラクティス

### 1. 厳密な型定義
```typescript
// ❌ 悪い例: any の使用
export interface BadExample {
  data: any
}

// ✅ 良い例: 具体的な型定義
export interface GoodExample {
  data: {
    id: string
    name: string
  }
}
```

### 2. Union Types の活用
```typescript
// ステータスを文字列リテラル型で定義
export type DebtorStatus = 'active' | 'inactive' | 'paid' | 'defaulted'

// 型安全な判定
function isActiveDebtor(status: DebtorStatus): boolean {
  return status === 'active' // タイポを防げる
}
```

### 3. ジェネリクスの活用
```typescript
// 汎用的なページネーション型
export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

// 使用例
type DebtorListResponse = PaginatedResponse<Debtor>
type ScenarioListResponse = PaginatedResponse<Scenario>
```

### 4. Utility Types の活用
```typescript
// 既存の型から派生型を作成
export type CreateDebtorInput = Omit<Debtor, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateDebtorInput = Partial<CreateDebtorInput>
export type DebtorKeys = keyof Debtor
```

## 型定義の更新フロー

### 1. Prisma スキーマとの同期
Prisma スキーマを更新したら、対応する shared/ の型定義も更新する

```prisma
// prisma/schema.prisma
model Debtor {
  id         String   @id @default(uuid())
  name       String
  email      String   @unique
  // 新しいフィールド追加
  address    String?
}
```

```typescript
// shared/types/src/debtor.ts
export interface Debtor {
  id: string
  name: string
  email: string
  // 対応する型を追加
  address?: string
}
```

### 2. バージョン管理
型定義に破壊的変更を加える場合は、段階的な移行を検討

```typescript
// 旧バージョン (deprecated)
/** @deprecated Use DebtorV2 instead */
export interface Debtor {
  // ...
}

// 新バージョン
export interface DebtorV2 {
  // ...
}
```

## まとめ

Shared モジュールの原則:
1. 型定義は shared/types/ で一元管理
2. エンティティ、リクエスト/レスポンス、ドメイン型を明確に分離
3. TypeScript strict mode で厳密な型チェック
4. Union Types、Generics、Utility Types を活用
5. Prisma スキーマとの同期を保つ
6. Frontend/Backend 双方で型安全性を確保
