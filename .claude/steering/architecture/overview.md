# プロジェクトアーキテクチャ概要

このドキュメントは、債権回収ロボシステムのアーキテクチャ全体像と設計原則を定義します。

## システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                    (localhost:3001)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    fetch("/api/*") ← 相対パス
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                           │
│                    (localhost:3001)                         │
│  - Next.js Rewrites により自動プロキシ                      │
│  - CORS制約なし（サーバー間通信）                           │
└─────────────────────────────────────────────────────────────┘
                              │
              fetch("http://localhost:3000/api/*")
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend                           │
│                    (localhost:3000)                         │
│  - REST API                                                 │
│  - Prisma ORM                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL                              │
│                  (Docker Container)                         │
└─────────────────────────────────────────────────────────────┘
```

## モノレポ構成

### ディレクトリ構造

```
debt-collect-robo/
├── frontend/           # Next.js フロントエンドアプリケーション
├── backend/            # NestJS バックエンドAPI
├── shared/             # frontend/backend で共通利用する型定義・モデル
├── infra/              # インフラストラクチャコード（CDK、Docker等）
├── specs/              # 設計ドキュメント
│   ├── adr/           # Architecture Decision Records (プロジェクト全体)
│   ├── epics/         # エピック技術方針
│   └── stories/       # ストーリー単位のドキュメント
│       └── {STORY_ID}-{title}/
│           ├── meta.json       # Notion-Git紐付け情報
│           ├── requirements.md # 要件定義書
│           ├── design.md       # 設計書
│           ├── plan.md         # 作業計画書
│           └── tasks/          # タスクファイル
└── .github/           # CI/CD、品質管理
```

### 各ディレクトリの役割

#### frontend/
- **技術スタック**: Next.js 16 (App Router)、TypeScript、TailwindCSS v4.0
- **役割**: ユーザーインターフェース、フロントエンドロジック
- **データフロー**: Backend APIを経由してデータを取得・更新

#### backend/
- **技術スタック**: NestJS、TypeScript、Prisma ORM
- **役割**: ビジネスロジック、データアクセス、API提供
- **責務**: 督促エンジン、REST API、データベース操作

#### shared/
- **役割**: 型定義・モデルの共通化
- **目的**: frontend/backend での型定義の二重管理を防ぐ
- **モノレポ採用の主な理由**: この共通化による開発効率と型安全性の向上

#### infra/
- **役割**: インフラストラクチャの定義とプロビジョニング
- **対象環境**: ローカル開発環境、テスト環境、本番環境
- **技術**: Docker Compose、AWS CDK等

#### specs/
- **役割**: プロジェクトの設計ドキュメント管理（ストーリー中心構造）
- **adr/**: 技術的な意思決定の記録（プロジェクト全体で通し番号）
- **epics/**: エピック全体のアーキテクチャ方針
- **stories/**: ストーリー単位で完結するドキュメント
  - 要件定義書（requirements.md）
  - 設計書（design.md）
  - 作業計画書（plan.md）
  - Notion紐付け情報（meta.json）

#### .github/
- **役割**: CI/CD、品質管理の自動化
- **内容**: GitHub Actions ワークフロー、PR テンプレート等

## 技術スタック詳細

### Frontend
- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript (strict mode)
- **UIライブラリ**: TailwindCSS v4.0
- **状態管理**: React Hooks (カスタムフック)
- **APIクライアント**: Fetch API
- **テスト**: Vitest、Playwright

### Backend
- **フレームワーク**: NestJS
- **言語**: TypeScript (strict mode)
- **ORM**: Prisma
- **データベース**: PostgreSQL
- **テスト**: Vitest

### 共通
- **品質管理**: Biome (Linter/Formatter)
- **型安全性**: TypeScript strict mode
- **モノレポ管理**: npm workspaces

## 設計原則

### 1. モノレポによる型安全性の確保
- frontend/backend 間で型定義を共有
- shared/ ディレクトリで一元管理
- TypeScript strict mode による厳密な型チェック

### 2. フレームワークベストプラクティスの遵守
- Next.js: App Router、Server Components/Client Components の適切な分離
- NestJS: モジュールベースアーキテクチャ、依存性注入の活用

### 3. 明確な責務分離
- Frontend: UIとユーザーインタラクション
- Backend: ビジネスロジックとデータ管理
- Shared: 型定義の共通化

### 4. 体系的な設計プロセス
- 要件定義 → ADR → Design Doc → 作業計画書 → 実装
- 品質重視: 速度より品質を優先
- YAGNI原則: 必要になるまで実装しない

## アーキテクチャ詳細

各技術スタックの詳細なアーキテクチャガイドは以下を参照:
- [Frontend アーキテクチャ](./frontend.md)
- [Backend アーキテクチャ](./backend.md)
- [Shared モジュール](./shared.md)

## 開発フロー

### 新機能開発の基本フロー
1. **要件定義**: specs/stories/{STORY_ID}-{title}/requirements.md を作成
2. **設計**: specs/adr/ で技術選定、specs/stories/{STORY_ID}-{title}/design.md で詳細設計
3. **実装計画**: specs/stories/{STORY_ID}-{title}/plan.md で作業計画書を作成
4. **実装**: Frontend/Backend の実装ガイドに従って実装
5. **テスト**: 単体テスト、統合テスト、E2Eテストの実装
6. **レビュー**: コードレビュー、設計レビュー
7. **デプロイ**: CI/CDパイプラインを経由してデプロイ

### 品質保証
- **型安全性**: TypeScript strict mode
- **コード品質**: Biome による静的解析
- **テストカバレッジ**: 70%以上を目標
- **E2Eテスト**: Playwright による自動テスト
- **CI/CD**: GitHub Actions による自動チェック

## セキュリティ

### CORS対策
- Next.js Rewrites によるプロキシ経由のAPI通信
- サーバー間通信のためCORS制約なし

### 認証・認可
- (今後実装予定)

### データ保護
- PostgreSQL による永続化
- 環境変数による機密情報の管理 (.env.example 参照)

## パフォーマンス

### Frontend
- Next.js Server Components による最適化
- 静的生成（SSG）と動的レンダリング（SSR）の使い分け
- 画像最適化

### Backend
- Prisma による効率的なデータベースクエリ
- NestJS の非同期処理
- コネクションプーリング

## 監視・運用

### ログ
- (今後実装予定)

### メトリクス
- (今後実装予定)

### エラー追跡
- (今後実装予定)

## 今後の拡張予定

### 認証・認可システム
- ユーザー認証機能の追加
- ロールベースアクセス制御 (RBAC)

### 監視・ログシステム
- アプリケーションログの集約
- パフォーマンスメトリクスの収集
- エラートラッキング

### インフラ自動化
- AWS CDK によるインフラストラクチャのコード化
- CI/CD パイプラインの拡充
