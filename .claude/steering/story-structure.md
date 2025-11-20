# ストーリー中心のディレクトリ構造ガイド

## 概要

AI駆動開発における最適化されたディレクトリ構造を定義します。NotionとGitの役割分担（SSOT原則）を明確にし、開発効率を最大化します。

## ディレクトリ構造

```
specs/
├── stories/{STORY_ID}-{title}/  # 例: DEBT-S-0001-user-authentication
│   ├── meta.json                # NotionとGitの紐付け（必須）
│   ├── requirements.md          # 要件定義書（必須、AIが生成）
│   ├── design.md                # 設計書（必須、AIが生成）
│   └── tasks/                   # タスク一覧（Gitでは管理しない）
│
├── epics/{EPIC_ID}-{title}/     # 例: DEBT-E-1-authentication-system
│   └── epic.md                  # エピック全体のアーキテクチャ方針
│
└── adr/                         # 技術的意思決定記録（通し番号）

```

## 各ディレクトリの役割

### `specs/stories/{STORY_ID}-{title}/`

**目的**: ストーリー単位で関連ドキュメントを集約

**配置ファイル**:
- `meta.json`: NotionとGitを紐付けるブリッジファイル（必須）
- `requirements.md`: 要件定義書（AIが生成、Git正）
- `design.md`: 設計書（AIが生成、Git正）

**命名規則**: `{STORY_ID}-{title}` 例: `DEBT-S-0001-user-authentication`

### `specs/epics/{EPIC_ID}-{title}/`

**目的**: エピック全体の技術方針を記録

**配置ファイル**: `epic.md` - エピック全体のアーキテクチャ方針、技術スタック、共通設計方針

**epic.mdに記載する内容**:
- ✅ 技術スタック、共通設計方針、セキュリティ要件、パフォーマンス要件、関連ADR
- ❌ 管理情報（ステータス、進捗率、担当PM、スケジュール）← Notionが正

**命名規則**: `{EPIC_ID}-{title}` 例: `DEBT-E-1-authentication-system`

### `specs/adr/`

**目的**: プロジェクト全体の技術的意思決定を記録

**命名規則**: `{num}-{title}.md` 例: `001-story-centric-directory-structure.md`（ストーリーIDは含めない）

**記載内容**: 背景（Context）、決定内容（Decision）、影響（Consequences）、代替案（Alternatives）

## NotionとGitの役割分担（SSOT原則）

**Single Source of Truth (SSOT)**: 同じ情報を複数の場所に保存しない。各情報には明確な「正」の保存場所がある。

### Notionが「正」とする情報（プロジェクト管理）

| 情報 | 保存場所 | 更新頻度 | 理由 |
|------|---------|---------|------|
| ストーリーステータス | Notion | 高 | PMが進捗を管理 |
| 担当者 | Notion | 高 | PMがアサインを管理 |
| 完了予定日 | Notion | 高 | PMがスケジュールを管理 |
| タスク一覧 | Notion | 高 | 計画段階で頻繁に更新 |
| 要件概要 | Notion | 中 | 計画段階のみ、AIが読み取り |

### Gitが「正」とする情報（技術ドキュメント）

| 情報 | 保存場所 | 更新頻度 | 理由 |
|------|---------|---------|------|
| 要件詳細 | Git (`requirements.md`) | 低 | AIが詳細化、実装段階以降が正 |
| 設計書 | Git (`design.md`) | 低 | AIが一度生成、以降固定 |
| ADR | Git (`specs/adr/`) | 低 | 技術的決定の記録 |
| epic.md（技術方針） | Git (`specs/epics/*/epic.md`) | 低 | エピック横断的な技術情報 |
| コード | Git | 高 | バージョン管理 |

### ブリッジ情報（NotionとGitを紐付け）

| 情報 | 保存場所 | 更新タイミング | 理由 |
|------|---------|---------------|------|
| Notion Story ID/URL | Git (`meta.json`) | エピック分解時 | NotionからGitへの参照 |
| GitHub PR URL | Git (`meta.json`) | PR作成時 | GitからNotionへの参照 |
