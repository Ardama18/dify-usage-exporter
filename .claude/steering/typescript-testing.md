# TypeScript テストルール

このドキュメントは、債権回収ロボシステムにおけるテスト戦略とルールを定義します。

## テストフレームワーク

### 単体テスト・統合テスト
- **Vitest**: Frontend/Backend の単体テスト・統合テストに使用
- **インポート**: `import { describe, it, expect, beforeEach, vi } from 'vitest'`
- **モック**: `vi.mock()` を使用

### E2Eテスト
- **Playwright**: Frontend の E2E テストに使用
- **対象**: ユーザーフローの主要シナリオ
- **実行環境**: ブラウザ自動化によるエンドツーエンドテスト

## テストの基本方針

### 品質要件
- **カバレッジ**: 単体テストのカバレッジは70%以上を必須
- **独立性**: 各テストは他のテストに依存せず実行可能
- **再現性**: テストは環境に依存せず、常に同じ結果を返す
- **可読性**: テストコードも製品コードと同様の品質を維持

### カバレッジ要件
- **必須基準**: 単体テストのカバレッジは70%以上
- **測定指標**: Statements（文）、Branches（分岐）、Functions（関数）、Lines（行）
- **重点領域**: ビジネスロジック、データ変換、バリデーション

### テストの種類と範囲

#### 1. 単体テスト（Unit Tests）
- **対象**: 個々の関数やコンポーネントの動作を検証
- **方針**: 外部依存はすべてモック化
- **粒度**: 最も数が多く、細かい粒度で実施
- **実行速度**: 高速実行を維持（全体で数秒以内）

#### 2. 統合テスト（Integration Tests）
- **対象**: 複数のコンポーネントの連携を検証
- **方針**: 実際の依存関係を使用（DB、API等）
- **検証内容**: 主要な機能フローの正常系・異常系
- **実行環境**: テスト用データベースを使用

#### 3. E2Eテスト（End-to-End Tests）
- **対象**: ユーザーフロー全体の動作検証
- **ツール**: Playwright
- **検証内容**:
  - 新機能追加時、既存機能への影響を必ず検証
  - Design Docの「統合ポイントマップ」で影響度「高」「中」の箇所をカバー
  - 検証パターン: 既存機能動作 → 新機能有効化 → 既存機能の継続性確認
- **判定基準**: レスポンス内容の変化なし、処理時間5秒以内
- **実行方式**: CI/CDでの自動実行を前提とした設計

## Red-Green-Refactorプロセス（テストファースト開発）

### 推奨原則
コード変更は必ずテストから始める

### 背景
- 変更前の動作を保証し、リグレッションを防止
- 期待する動作を明確化してから実装
- リファクタリング時の安全性を確保

### 開発ステップ
1. **Red**: 期待する動作のテストを書く（失敗する）
2. **Green**: 最小限の実装でテストを通す
3. **Refactor**: テストが通る状態を維持しながらコード改善

### 適用除外ケース
- 純粋な設定ファイル変更（.env、config等）
- ドキュメントのみの更新（README、コメント等）
- 緊急本番障害対応（ただし事後テスト必須）

## Frontend テスト戦略 (Next.js 15)

### Server Components のテスト
Server Components は通常の React コンポーネントとしてテスト可能

```typescript
// tests/unit/app/dashboard/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/dashboard/page'

// データフェッチをモック
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({
    debtors: [],
    total: 0,
  }),
}))

describe('DashboardPage', () => {
  it('should render dashboard', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument()
  })
})
```

### Client Components のテスト
ユーザーインタラクションを含むコンポーネントのテスト

```typescript
// tests/unit/components/features/debtor/DebtorForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DebtorForm } from '@/components/features/debtor/DebtorForm'

describe('DebtorForm', () => {
  it('should submit form with valid data', async () => {
    const onSubmit = vi.fn()
    render(<DebtorForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('名前'), {
      target: { value: 'Test User' },
    })
    fireEvent.click(screen.getByRole('button', { name: '登録' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test User',
    })
  })
})
```

### カスタムフックのテスト
```typescript
// tests/unit/hooks/api/useDebtors.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDebtors } from '@/hooks/api/useDebtors'

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue([
    { id: '1', name: 'Test' },
  ]),
}))

describe('useDebtors', () => {
  it('should fetch debtors', async () => {
    const { result } = renderHook(() => useDebtors())

    await waitFor(() => {
      expect(result.current.debtors).toHaveLength(1)
    })
  })
})
```

### E2Eテスト (Playwright)
```typescript
// tests/e2e/debtor-management.spec.ts
import { test, expect } from '@playwright/test'

test.describe('債務者管理', () => {
  test('債務者を新規登録できる', async ({ page }) => {
    await page.goto('http://localhost:3001/dashboard')

    // 新規登録ボタンをクリック
    await page.click('text=新規登録')

    // フォーム入力
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="debtAmount"]', '10000')

    // 登録実行
    await page.click('button[type="submit"]')

    // 登録成功の確認
    await expect(page.locator('text=登録しました')).toBeVisible()
  })
})
```

## Backend テスト戦略 (NestJS)

### Service のテスト（単体テスト）
```typescript
// test/unit/modules/debtors/debtors.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { DebtorsService } from '@/modules/debtors/debtors.service'
import { PrismaService } from '@/prisma/prisma.service'

describe('DebtorsService', () => {
  let service: DebtorsService
  let prisma: PrismaService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DebtorsService,
        {
          provide: PrismaService,
          useValue: {
            debtor: {
              create: vi.fn(),
              findMany: vi.fn(),
              findUnique: vi.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<DebtorsService>(DebtorsService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should create a debtor', async () => {
    const createDto = {
      name: 'Test',
      email: 'test@example.com',
      phone: '123',
      debtAmount: 1000,
      status: 'active',
    }

    vi.spyOn(prisma.debtor, 'create').mockResolvedValue({
      id: '1',
      ...createDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await service.create(createDto)
    expect(result.name).toBe('Test')
    expect(prisma.debtor.create).toHaveBeenCalledWith({
      data: createDto,
    })
  })
})
```

### Controller のテスト（単体テスト）
```typescript
// test/unit/modules/debtors/debtors.controller.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { DebtorsController } from '@/modules/debtors/debtors.controller'
import { DebtorsService } from '@/modules/debtors/debtors.service'

describe('DebtorsController', () => {
  let controller: DebtorsController
  let service: DebtorsService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DebtorsController],
      providers: [
        {
          provide: DebtorsService,
          useValue: {
            findAll: vi.fn(),
            create: vi.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<DebtorsController>(DebtorsController)
    service = module.get<DebtorsService>(DebtorsService)
  })

  it('should return all debtors', async () => {
    const mockDebtors = [{ id: '1', name: 'Test' }]
    vi.spyOn(service, 'findAll').mockResolvedValue(mockDebtors)

    const result = await controller.findAll()
    expect(result).toEqual(mockDebtors)
  })
})
```

### 統合テスト（E2E）
```typescript
// test/integration/debtors.int.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '@/app.module'
import { PrismaService } from '@/prisma/prisma.service'

describe('Debtors API (Integration)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = module.createNestApplication()
    prisma = module.get<PrismaService>(PrismaService)
    await app.init()
  })

  afterEach(async () => {
    // テストデータクリーンアップ
    await prisma.debtor.deleteMany()
    await app.close()
  })

  it('POST /debtors should create a debtor', async () => {
    const createDto = {
      name: 'Test',
      email: 'test@example.com',
      phone: '123',
      debtAmount: 1000,
      status: 'active',
    }

    const response = await request(app.getHttpServer())
      .post('/debtors')
      .send(createDto)
      .expect(201)

    expect(response.body.name).toBe('Test')
    expect(response.body.id).toBeDefined()
  })

  it('GET /debtors should return all debtors', async () => {
    // テストデータ作成
    await prisma.debtor.create({
      data: {
        name: 'Test',
        email: 'test@example.com',
        phone: '123',
        debtAmount: 1000,
        status: 'active',
      },
    })

    const response = await request(app.getHttpServer())
      .get('/debtors')
      .expect(200)

    expect(response.body).toHaveLength(1)
    expect(response.body[0].name).toBe('Test')
  })
})
```

## テストの実装規約

### ディレクトリ構造

#### Frontend
```
frontend/
├── app/
│   └── dashboard/
│       └── page.tsx
├── components/
│   └── features/
│       └── debtor/
│           └── DebtorForm.tsx
└── tests/
    ├── unit/
    │   ├── app/
    │   │   └── dashboard/
    │   │       └── page.test.tsx
    │   └── components/
    │       └── features/
    │           └── debtor/
    │               └── DebtorForm.test.tsx
    ├── integration/
    │   └── debtor-management.int.test.tsx
    └── e2e/
        └── debtor-management.spec.ts
```

#### Backend
```
backend/
├── src/
│   └── modules/
│       └── debtors/
│           ├── debtors.controller.ts
│           └── debtors.service.ts
└── test/
    ├── unit/
    │   └── modules/
    │       └── debtors/
    │           ├── debtors.controller.test.ts
    │           └── debtors.service.test.ts
    └── integration/
        └── debtors.int.test.ts
```

### 命名規則
- **単体テスト**: `{対象ファイル名}.test.ts`
- **統合テスト**: `{対象ファイル名}.int.test.ts`
- **E2Eテスト**: `{機能名}.spec.ts`
- **テストスイート**: 対象の機能や状況を説明する名前
- **テストケース**: 期待される動作を説明する名前

## テストの設計原則

### テストケースの構造（AAA パターン）
- **Arrange（準備）**: テストデータとモックの準備
- **Act（実行）**: テスト対象の実行
- **Assert（検証）**: 期待値との比較

```typescript
it('should calculate total price', () => {
  // Arrange
  const price = 100
  const tax = 0.1

  // Act
  const result = calculateTotal(price, tax)

  // Assert
  expect(result).toBe(110)
})
```

### テストデータ管理
- **最小限のデータ**: テストの目的に必要なデータのみ使用
- **明示的な値**: マジックナンバーを避け、意図が明確な値を使用
- **テストデータビルダー**: 複雑なデータは専用ビルダーを活用

```typescript
// テストデータビルダーの例
class DebtorBuilder {
  private data = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '123-456-7890',
    debtAmount: 10000,
    status: 'active' as const,
  }

  withName(name: string) {
    this.data.name = name
    return this
  }

  withDebtAmount(amount: number) {
    this.data.debtAmount = amount
    return this
  }

  build() {
    return this.data
  }
}

// 使用例
const debtor = new DebtorBuilder()
  .withName('John Doe')
  .withDebtAmount(5000)
  .build()
```

### モックとスタブの使用方針

#### 推奨: 単体テストでの外部依存モック化
- **メリット**: テストの独立性と再現性を確保
- **対象**: DB、API、ファイルシステム等の外部依存
- **ツール**: Vitest の `vi.mock()`、`vi.fn()` を使用

```typescript
// ✅ 良い例: 外部依存をモック化
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}))
```

#### 避けるべき: 単体テストでの実際の外部接続
- **理由**: テスト速度が遅くなり、環境依存の問題が発生
- **代替案**: 統合テストで実際の接続をテスト

### テスト失敗時の対応判断基準

#### テストを修正すべきケース
- 間違った期待値を設定している
- 存在しない機能を参照している
- 実装詳細に依存している
- テストのためだけの実装がある

#### 実装を修正すべきケース
- テストが妥当な仕様を表現している
- ビジネスロジックに問題がある
- 重要なエッジケースが考慮されていない

#### 判断に迷った場合
- ユーザーに確認する
- Design Doc と照合する

## テストコードの品質ルール

### 推奨: すべてのテストを常に有効に保つ
- **メリット**: テストスイートの完全性を保証
- **実践**: 問題があるテストは修正して有効化

```typescript
// ✅ 良い例: テストを修正して有効化
it('should handle error cases', () => {
  expect(() => processData(null)).toThrow()
})
```

### 避けるべき: test.skip() やコメントアウト
- **理由**: テストの穴が生まれ、品質チェックが不完全になる
- **対処**: 不要なテストは完全に削除する

```typescript
// ❌ 悪い例: テストをスキップ
it.skip('should do something', () => {
  // ...
})

// ✅ 良い例: 不要なら削除
```

## テストの粒度

### 原則: 観測可能な振る舞いのみをテスト

#### テスト対象
- 公開API（関数、メソッド）
- 戻り値
- 例外
- 外部呼び出し（モックで検証）
- 永続化された状態

#### テスト対象外
- private メソッド
- 内部状態
- アルゴリズムの詳細

```typescript
// ✅ 良い例: 振る舞いをテスト
expect(calculatePrice(100, 0.1)).toBe(110)

// ❌ 悪い例: 実装詳細をテスト
expect((calculator as any).taxRate).toBe(0.1)
```

## モックの型安全性

### 必要最小限の型定義
```typescript
// ✅ 良い例: 必要な部分のみ定義
type TestDebtorService = Pick<DebtorsService, 'create' | 'findAll'>

const mockService: TestDebtorService = {
  create: vi.fn(),
  findAll: vi.fn(),
}
```

### やむを得ない場合の対処
```typescript
// やむを得ない場合のみ、理由を明記
const sdkMock = {
  call: vi.fn()
} as unknown as ExternalSDK // 外部SDKの複雑な型のため
```

## 継続性テストの範囲

新機能追加時の既存機能への影響確認に限定。長時間運用・負荷テストはインフラ層の責務のため対象外。

## テストヘルパーの活用

### 基本原則
テストコードの重複を減らし、保守性を高めるために活用

### 判断基準
| モックの特性 | 対応方針 |
|-------------|---------|
| **単純で安定** | 共通ヘルパーに集約 |
| **複雑または変更頻度高** | 個別実装 |
| **3箇所以上で重複** | 共通化を検討 |
| **テスト固有ロジック** | 個別実装 |

## まとめ

テスト戦略のポイント:
1. **Vitest**: Frontend/Backend の単体テスト・統合テスト
2. **Playwright**: Frontend の E2E テスト
3. **カバレッジ70%以上**: 品質基準を維持
4. **テストファースト**: Red-Green-Refactor サイクル
5. **Next.js/NestJS固有**: フレームワークに適したテスト戦略
6. **型安全性**: shared/ の型を活用した型安全なテスト
7. **AAA パターン**: 構造化されたテストコード
