# プロジェクトコンテキスト

このドキュメントは、債権回収ロボシステムの特性、背景、開発体制など、コード実装時に常に意識すべきコンテキストを定義します。

## プロジェクト概要

### プロジェクトの性質
- **プロジェクト名**: 債権回収ロボ (Debt Collection Robot)
- **目的**: 企業の債権回収の効率化と回収率の向上
- **対象ユーザー**: 企業の債権管理部門、督促担当者
- **実装方針**: LLM主導実装、品質重視、YAGNI原則徹底

### 技術スタック
- **モノレポ構成**: npm workspaces
- **言語**: TypeScript (strict mode)
- **フロントエンド**: Next.js 16 (App Router)、TailwindCSS v4.0
- **バックエンド**: NestJS、Prisma ORM
- **データベース**: PostgreSQL
- **テストフレームワーク**: Vitest、Playwright
- **品質管理**: Biome、TypeScript strict mode
- **インフラ**: Docker、Docker Compose、AWS CDK (予定)

## システム特性

### ビジネス要件
- **債務者管理**: 債務者情報の登録・更新・検索
- **督促シナリオ**: 段階的な督促フローの設定と自動実行
- **督促履歴**: 督促活動の記録と追跡
- **ダッシュボード**: 債権回収状況の可視化

### 技術的制約
- **データ整合性**: PostgreSQLによる永続化と整合性保証
- **型安全性**: frontend/backend 間での型共有 (shared/)
- **CORS対策**: Next.js Rewrites によるプロキシ経由API通信
- **セキュリティ**: 環境変数による機密情報管理

## 実装原則

### 開発方針
- **LLM主導実装**: Claude Codeが主要な実装者として機能
- **品質重視**: 速度より品質を優先
- **YAGNI原則**: 必要になるまで実装しない
- **体系的な設計**: ADR/Design Doc/作業計画書による設計プロセス
- **ベストプラクティス遵守**: Next.js、NestJS のフレームワーク推奨パターンを採用

### アーキテクチャ
- **Next.js App Router**: Server Components/Client Components の適切な分離
- **NestJS モジュール**: 機能ごとのモジュール分離、依存性注入の活用
- **型共有**: shared/ での型定義一元管理
- **詳細**: `.claude/steering/architecture/` を参照

### コーディング規約
- **TypeScript strict mode**: 厳密な型チェック
- **Biome**: 統一されたコードスタイル
- **命名規則**:
  - ファイル: kebab-case
  - コンポーネント: PascalCase
  - 関数・変数: camelCase
  - 型: PascalCase

## 開発フロー

### 機能開発プロセス
1. **要件定義**: specs/stories/{NOTION_STORY_ID}-{title}/requirements.md を作成
2. **技術選定**: specs/adr/ で ADR を作成
3. **詳細設計**: specs/stories/{NOTION_STORY_ID}-{title}/design.md を作成
4. **実装計画**: specs/stories/{NOTION_STORY_ID}-{title}/plan.md を作成
5. **実装**: アーキテクチャガイドに従って実装
6. **テスト**: 単体テスト、統合テスト、E2Eテストの実装
7. **レビュー**: コードレビュー、設計レビュー
8. **デプロイ**: CI/CDパイプラインを経由

### 品質基準
- **型安全性**: TypeScript strict mode
- **コード品質**: Biome による静的解析
- **テストカバレッジ**: 70%以上を目標
- **E2Eテスト**: Playwright による主要フローのテスト

## 環境管理

### 開発環境
- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:3000
- **Database**: PostgreSQL (Docker)

### 環境変数
```bash
# Frontend (.env.local)
BACKEND_API_URL=http://localhost:3000

# Backend (.env)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/debt_collect"
```

## プロジェクト構成

```
debt-collect-robo/
├── frontend/       # Next.js フロントエンド
├── backend/        # NestJS バックエンド
├── shared/         # 型定義の共通化
├── infra/          # インフラコード
├── specs/          # 設計ドキュメント
└── .github/        # CI/CD
```

詳細は `.claude/steering/architecture/overview.md` を参照。