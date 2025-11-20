# Frontend アーキテクチャ (Next.js 16)

このドキュメントは、Next.js 16 (App Router) を使用したフロントエンドアプリケーションのアーキテクチャを定義します。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript (strict mode)
- **UIライブラリ**: TailwindCSS v4.0
- **状態管理**: React Hooks (カスタムフック)
- **APIクライアント**: Fetch API
- **テスト**: Vitest (単体テスト)、Playwright (E2E)

## ディレクトリ構造

```
frontend/
├── app/                    # App Router (Next.js 16)
│   ├── layout.tsx         # ルートレイアウト
│   ├── page.tsx           # トップページ
│   ├── dashboard/         # ダッシュボード機能
│   │   ├── page.tsx
│   │   └── layout.tsx
│   └── api/               # API Routes (必要に応じて)
├── components/            # 再利用可能なUIコンポーネント
│   ├── ui/               # 汎用UIコンポーネント (Button, Input等)
│   └── features/         # 機能特化型コンポーネント
├── hooks/                # カスタムフック
│   ├── api/             # API呼び出し用フック
│   └── state/           # 状態管理用フック
├── lib/                  # ユーティリティ、設定
│   ├── api-client.ts    # API クライアント設定
│   └── utils.ts         # 汎用ユーティリティ関数
├── types/               # フロントエンド固有の型定義
├── styles/              # グローバルスタイル
├── public/              # 静的ファイル
└── tests/               # テストファイル
    ├── unit/           # 単体テスト
    └── e2e/            # E2Eテスト
```

## Next.js 16 App Router ベストプラクティス

### 1. Server Components と Client Components の使い分け

#### Server Components (デフォルト)
Server Components は以下の場合に使用:
- データフェッチング (API呼び出し)
- データベースアクセス (直接アクセスが必要な場合)
- バックエンドリソースへのアクセス
- 機密情報の処理
- サーバー依存の大きなライブラリ使用

```typescript
// app/dashboard/page.tsx
// Server Component (デフォルト)
export default async function DashboardPage() {
  // サーバーサイドでデータフェッチ
  const data = await fetch('http://localhost:3000/api/dashboard')
  const dashboard = await data.json()

  return (
    <div>
      <DashboardView data={dashboard} />
    </div>
  )
}
```

#### Client Components
Client Components は以下の場合に使用:
- イベントリスナー (onClick, onChange等)
- State、Effect の使用 (useState, useEffect等)
- ブラウザ専用API の使用
- カスタムフックの使用
- React Class コンポーネント

```typescript
// components/features/dashboard/DashboardView.tsx
'use client'

import { useState } from 'react'

export function DashboardView({ data }) {
  const [filter, setFilter] = useState('')

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {/* ... */}
    </div>
  )
}
```

### 2. ページとレイアウト

#### ページ構成
```typescript
// app/dashboard/page.tsx
import { Metadata } from 'next'

// メタデータのエクスポート
export const metadata: Metadata = {
  title: 'ダッシュボード | 債権回収ロボ',
  description: '督促管理ダッシュボード',
}

// ページコンポーネント
export default async function DashboardPage() {
  return (
    <main>
      {/* コンテンツ */}
    </main>
  )
}
```

#### レイアウト構成
```typescript
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-layout">
      <aside>
        {/* サイドバー */}
      </aside>
      <main>{children}</main>
    </div>
  )
}
```

### 3. データフェッチング戦略

#### サーバーサイドフェッチング (推奨)
```typescript
// Server Component でのデータフェッチ
async function getData() {
  const res = await fetch('http://localhost:3000/api/data', {
    // キャッシュ戦略の指定
    next: { revalidate: 3600 } // 1時間ごとに再検証
  })

  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }

  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{/* データを使用 */}</div>
}
```

#### クライアントサイドフェッチング (インタラクティブな場合)
```typescript
// hooks/api/useDebtors.ts
'use client'

import { useState, useEffect } from 'react'

export function useDebtors() {
  const [debtors, setDebtors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/debtors')
      .then(res => res.json())
      .then(setDebtors)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  return { debtors, loading, error }
}
```

### 4. API通信

#### API クライアント設定
```typescript
// lib/api-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}
```

#### Next.js Rewrites によるプロキシ
```typescript
// next.config.ts
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL}/:path*`,
      },
    ]
  },
}
```

## コンポーネント設計

### 1. コンポーネント分類

#### UI コンポーネント (components/ui/)
再利用可能な汎用UIコンポーネント
```typescript
// components/ui/Button.tsx
'use client'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}
```

#### Feature コンポーネント (components/features/)
特定機能に特化したコンポーネント
```typescript
// components/features/debtor/DebtorCard.tsx
'use client'

import { Debtor } from '@/shared/types'

interface DebtorCardProps {
  debtor: Debtor
}

export function DebtorCard({ debtor }: DebtorCardProps) {
  return (
    <div className="debtor-card">
      <h3>{debtor.name}</h3>
      <p>{debtor.amount}</p>
    </div>
  )
}
```

### 2. カスタムフック設計

#### API フック
```typescript
// hooks/api/useDebtors.ts
'use client'

import { useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { Debtor } from '@/shared/types'

export function useDebtors() {
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchDebtors = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient<Debtor[]>('/debtors')
      setDebtors(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createDebtor = useCallback(async (debtor: Omit<Debtor, 'id'>) => {
    const newDebtor = await apiClient<Debtor>('/debtors', {
      method: 'POST',
      body: JSON.stringify(debtor),
    })
    setDebtors(prev => [...prev, newDebtor])
    return newDebtor
  }, [])

  return {
    debtors,
    loading,
    error,
    fetchDebtors,
    createDebtor,
  }
}
```

## スタイリング (TailwindCSS v4.0)

### 1. CSS-first Configuration

TailwindCSS v4 では、従来の `tailwind.config.js/ts` が不要になり、**CSSファイル内で直接設定**を記述します。

#### グローバルスタイル (app/globals.css)
```css
/* app/globals.css */
@import "tailwindcss";

/* デザイントークンの定義 */
@theme {
  /* カスタムカラー（OKLch色空間対応） */
  --color-primary-50: oklch(0.98 0.02 220);
  --color-primary-100: oklch(0.95 0.04 220);
  --color-primary-500: oklch(0.6 0.15 220);
  --color-primary-600: oklch(0.5 0.18 220);
  --color-primary-700: oklch(0.4 0.2 220);

  /* カスタムフォント */
  --font-display: "Inter", "sans-serif";

  /* カスタムブレークポイント（必要に応じて） */
  --breakpoint-3xl: 1920px;

  /* カスタムイージング */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}

/* ベーススタイル */
@layer base {
  :root {
    --foreground-rgb: 0, 0, 0;
    --background-rgb: 255, 255, 255;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --foreground-rgb: 255, 255, 255;
      --background-rgb: 0, 0, 0;
    }
  }

  body {
    color: rgb(var(--foreground-rgb));
    background: rgb(var(--background-rgb));
  }
}

/* カスタムコンポーネントクラス */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors;
  }

  .card {
    @apply bg-white shadow-md rounded-lg p-4 border border-gray-200;
  }
}
```

#### PostCSS 設定 (postcss.config.mjs)
```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**重要な変更点:**
- `@import "tailwindcss"` で Tailwind を読み込み（`@tailwind` ディレクティブは不要）
- `@theme` ブロックでデザイントークンを CSS 変数として定義
- すべてのカスタムトークンがネイティブ CSS 変数として全域で参照可能
- `tailwind.config.ts` ファイルは不要

### 2. CSS変数としてのデザイントークン活用

TailwindCSS v4 では、`@theme` で定義したトークンがネイティブ CSS 変数として生成されます。

#### Tailwindクラスでの使用
```tsx
// 通常のTailwindクラスとして使用可能
<div className="bg-primary-600 text-white">
  Primary Color
</div>

// カスタムブレークポイント
<div className="hidden 3xl:block">
  3XL以上で表示
</div>
```

#### CSS変数として直接参照
```css
/* カスタムCSS内で参照 */
.custom-gradient {
  background: linear-gradient(
    to right,
    var(--color-primary-500),
    var(--color-primary-700)
  );
}
```

#### JavaScriptから参照
```typescript
// components/ui/CustomComponent.tsx
export function CustomComponent() {
  // CSS変数として参照可能
  const primaryColor = 'var(--color-primary-600)'

  return (
    <div style={{ borderColor: primaryColor }}>
      {/* ... */}
    </div>
  )
}
```

### 3. コンポーネントでの使用

#### UI コンポーネント例
```typescript
// components/ui/Button.tsx
'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const baseStyles = 'rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}
```

#### ユーティリティ関数 (cn)
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind クラスのマージとオーバーライドを適切に処理
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

#### Feature コンポーネント例
```typescript
// components/features/dashboard/DashboardView.tsx
'use client'

import { useState } from 'react'

export function DashboardView() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">
        ダッシュボード
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="text-xl font-semibold mb-2">債務者数</h2>
          <p className="text-3xl font-bold text-primary-600">1,234</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-2">回収率</h2>
          <p className="text-3xl font-bold text-green-600">87.5%</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-2">督促中</h2>
          <p className="text-3xl font-bold text-orange-600">456</p>
        </div>
      </div>
    </div>
  )
}
```

### 4. レスポンシブデザイン

TailwindCSS のブレークポイントを活用したレスポンシブデザイン：

```typescript
// components/features/layout/Header.tsx
export function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ: モバイルでは小さく、デスクトップでは大きく */}
          <div className="text-xl md:text-2xl font-bold text-primary-600">
            債権回収ロボ
          </div>

          {/* ナビゲーション: モバイルでは非表示、タブレット以上で表示 */}
          <nav className="hidden md:flex space-x-4">
            <a href="/dashboard" className="text-gray-700 hover:text-primary-600">
              ダッシュボード
            </a>
            <a href="/debtors" className="text-gray-700 hover:text-primary-600">
              債務者管理
            </a>
          </nav>

          {/* ハンバーガーメニュー: モバイルのみ表示 */}
          <button className="md:hidden p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
```

TailwindCSS ブレークポイント：
- `sm`: 640px以上
- `md`: 768px以上
- `lg`: 1024px以上
- `xl`: 1280px以上
- `2xl`: 1536px以上

## 型安全性

### 1. shared/ からの型インポート
```typescript
// components/features/debtor/DebtorList.tsx
import type { Debtor } from '@/shared/types'

interface DebtorListProps {
  debtors: Debtor[]
}

export function DebtorList({ debtors }: DebtorListProps) {
  // ...
}
```

### 2. フロントエンド固有の型
```typescript
// types/ui.ts
export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface FilterState {
  search: string
  status: string[]
}
```

## テスト戦略

### 1. 単体テスト (Vitest)
```typescript
// components/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    fireEvent.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

### 2. E2Eテスト (Playwright)
```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test('should display dashboard', async ({ page }) => {
  await page.goto('http://localhost:3001/dashboard')

  await expect(page.getByRole('heading', { name: 'ダッシュボード' }))
    .toBeVisible()
})
```

## パフォーマンス最適化

### 1. 画像最適化
```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority // Above the fold の画像
/>
```

### 2. 動的インポート
```typescript
// 重いコンポーネントの遅延ロード
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
})
```

### 3. メモ化
```typescript
'use client'

import { useMemo } from 'react'

export function ExpensiveComponent({ data }) {
  const processedData = useMemo(() => {
    return data.map(/* 重い処理 */)
  }, [data])

  return <div>{/* processedData を使用 */}</div>
}
```

## エラーハンドリング

### 1. エラーバウンダリ
```typescript
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>エラーが発生しました</h2>
      <p>{error.message}</p>
      <button onClick={reset}>再試行</button>
    </div>
  )
}
```

### 2. ローディング状態
```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return <div>Loading...</div>
}
```

## セキュリティ

### 1. 環境変数
```bash
# .env.local
BACKEND_API_URL=http://localhost:3000
```

### 2. XSS対策
- React の自動エスケープを活用
- dangerouslySetInnerHTML の使用を避ける

## まとめ

Next.js 16 App Router + TailwindCSS v4.0 のベストプラクティス:

### アーキテクチャ
1. Server Components をデフォルトとし、必要な場合のみ Client Components を使用
2. データフェッチングはサーバーサイドで実施
3. コンポーネントは ui/ と features/ で分類
4. カスタムフックで API 呼び出しをカプセル化
5. shared/ から型定義をインポートして型安全性を確保

### スタイリング (TailwindCSS v4.0)
6. **CSS-first Configuration**: `tailwind.config.ts` 不要、`@import "tailwindcss"` で導入
7. **@theme ブロック**: デザイントークンを CSS 変数として定義
8. **ネイティブ CSS 変数**: すべてのトークンが `var(--color-*)` として全域参照可能
9. **cn() ユーティリティ**: clsx + tailwind-merge で柔軟なクラス管理
10. **OKLch色空間**: 最新の色空間対応で色の一貫性を確保

### テスト
11. Vitest と Playwright でテスト
