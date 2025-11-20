---
description: エピックをストーリーに分解し、ストーリーを一括作成
---

**コマンドコンテキスト**: Epic層の管理（エピック分解→ストーリー一括作成）

## 初回必須タスク

作業開始前に以下のルールファイルを必ず読み込み、厳守してください：
- @.claude/steering/core-principles.md - 全エージェント共通原則（タスク管理、品質基準、エラー対応）
- @.claude/steering/story-structure.md - ディレクトリ構造とSSOT原則
- @.claude/steering/sub-agents.md - サブエージェント管理フロー

## 責務

**Epic層のみ担当**（Story層は/implementコマンドが担当）

このコマンドは複数のエージェントをオーケストレーションします：
1. **notion-client**: エピック情報取得、ストーリーページ作成、レビュータスク作成
2. **epic-decomposer**: エピックのストーリー分解、ディレクトリ構造作成

**責務境界**：
- ✅ エピック→ストーリー分解（epic-decomposerが実行）
- ✅ エピックディレクトリ作成（epic-decomposerが実行）
- ✅ epic.md生成（epic-decomposerが技術方針のみ生成、ストーリー一覧は空）
- ✅ ストーリーページ作成（Notion、notion-clientが実行）
- ✅ NotionからuserDefined:ID取得（notion-clientが実行）
- ✅ ストーリーディレクトリ作成（実際のuserDefined:IDを使用）
- ✅ meta.json作成（実際のNotion情報を使用）
- ✅ epic.mdにストーリー一覧を追記（実際のuserDefined:IDを使用）
- ❌ ストーリーの設計・実装（/implementコマンドが担当）

## 入力

```
/epic-to-stories <エピックURL> [追加指示]
```

**引数**：
- `<エピックURL>` (必須): Epic ページのURL
- `[追加指示]` (任意): ユーザーからの追加要望・制約・方針
  - 例: 「モバイルファーストで設計」「既存DBスキーマを流用」「セキュリティ重視」

## 実行フロー

### Step 1: エピックURL検証

```
1. 引数チェック: エピックURLが指定されているか確認
2. エラー時:
   - エラーメッセージを表示
   - 使用例を提示
   - 処理を中断
```

### Step 2: notion-client(fetch_epic) 実行

```
1. notion-clientエージェントを呼び出し:
   - 操作: fetch_epic
   - 入力: epicUrl
   - 出力: epicData (epicId, title, description, requirements, notionUrl)

2. エラーハンドリング:
   - 接続失敗 → エラーメッセージ表示、処理中断
   - エピックURL不正 → エラーメッセージ表示、処理中断
   - タイムアウト → リトライ後、失敗時は中断
```

### Step 3: epic-decomposer実行

```
1. epic-decomposerエージェントを呼び出し:
   - 入力:
     - epicData（Step 2の出力 - Notionから取得したエピック情報）
     - userRequest（ユーザーからの追加指示）
   - 処理内容:
     - エピック全体のアーキテクチャ方針策定（ストーリー間で共通する要素をepic.mdに記載）
     - ストーリー分解（リリース単位、必要最小限）
     - 各ストーリーの詳細な要件を生成（要件概要、機能詳細、技術要件、UI仕様）
     - エピックディレクトリ作成（specs/epics/のみ）
     - epic.md生成（Notion情報 + ユーザー追加指示を反映）
   - 出力: storiesData (epicId, epicDirectory, stories[{title, summary, detailedContent}], implementationOrder[])

2. エラーハンドリング:
   - ディレクトリ作成失敗 → エラーメッセージ表示、処理中断
```

**重要な変更点**:
- ストーリーディレクトリは作成**しない**（NotionのuserDefined:ID取得後に作成）
- meta.jsonも作成**しない**（NotionページURL確定後に作成）
- stories配列にはstoryIdは含まれない（Notion自動採番前のため）
- stories配列には`summary`（簡潔な概要）と`detailedContent`（詳細な要件）が含まれる

### Step 4: ユーザー確認（分解結果の承認）

```
1. epic-decomposerの出力を表示:
   - エピックID、タイトル
   - 生成されたストーリー一覧（ID、タイトル）
   - 実装順序の推奨
   - ディレクトリ構造

2. ユーザーに確認を求める:
   「このストーリー分解で進めてよろしいですか？ (yes/no)」

3. ユーザー応答のハンドリング:
   - "yes" または "y": Step 5へ進む
   - "no" または "n": 処理をキャンセル、メッセージ表示して終了
   - その他: 再度確認を求める
```

### Step 5: notion-client(create_stories) 実行

```
1. notion-clientエージェントを呼び出し:
   - 操作: create_stories
   - 入力:
     - epicId: エピックID
     - epicUrl: エピックのNotionページURL
     - stories[] (Step 3の出力):
       - title: ストーリータイトル
       - summary: 簡潔な要件概要（1-2行）
       - detailedContent: 詳細な要件定義（Markdown形式、複数セクション含む）
         ※必ずepic-decomposerが生成した完全なdetailedContentを渡すこと
   - 処理内容:
     - ストーリーページ一括作成
     - 各ページの本文（content）にdetailedContentを書き込み
   - 出力: createdStories[] (storyId, notionUrl)

2. エラーハンドリング:
   - 接続失敗 → エラーメッセージ表示、処理中断
   - 部分的成功 → 成功/失敗した項目を明示、ユーザーに報告
```

**🚨 重要・必須・省略厳禁**: epic-decomposerが生成した`detailedContent`（詳細な要件定義）を**必ず完全な形で**notion-clientに渡すこと。

**厳禁行為**:
- ❌ detailedContentを「(省略)」などと省略して渡すこと
- ❌ summaryだけを渡してdetailedContentを渡さないこと
- ❌ detailedContentの一部だけを渡すこと

**正しい渡し方の例**:
```typescript
// ✅ 正しい: epic-decomposerの出力をそのまま使用
stories: decomposerOutput.data.stories  // そのまま渡す！省略しない！
```

**誤った渡し方の例**:
```typescript
// ❌ 間違い: detailedContentを省略
stories: [{
  title: decomposerOutput.data.stories[0].title,
  summary: decomposerOutput.data.stories[0].summary,
  detailedContent: "(省略)"  // これは絶対にやってはいけない！
}]
```

**理由**:
- summaryだけを渡すと、Notionページには簡潔な概要しか記載されない
- 実装に必要な詳細情報（機能仕様、技術要件、UI仕様）が欠落する
- 開発者が実装できなくなる

**detailedContentの検証**:
- 「# 要件概要」「# 機能要件の詳細」「# 技術要件」などのセクションを含むはず
- 省略されている場合は即座にエラーとして処理を中断すること

### Step 5.5: NotionからuserDefined:ID取得

```
各作成されたストーリーについて:
1. notion-clientエージェントを呼び出し:
   - 操作: fetch_story
   - 入力: storyUrl（Step 5の出力）
   - 出力: storyData（storyId（userDefined:ID）, title, notionUrl）

2. エラーハンドリング:
   - 取得失敗 → エラーメッセージ表示、処理中断
```

**重要**: このステップでNotionが自動採番したuserDefined:IDを取得します（例: TC-S--8）

### Step 6: Gitディレクトリとmeta.json作成

```
各ストーリーについて:
1. userDefined:IDとtitleを使ってディレクトリ作成:
   `specs/stories/{userDefined:ID}-{title}/`
   例: `specs/stories/TC-S--8-parent-task-creation-distribution/`

2. meta.jsonを作成:
   - notion_story_id: Step 5.5で取得したuserDefined:ID
   - notion_story_url: Step 5で取得したNotionページURL
   - notion_epic_id: エピックID
   - initial_assigned_to: ""
   - initial_planned_completion: ""

3. `specs/stories/{userDefined:ID}-{title}/meta.json` に保存
```

**重要な変更点**:
- ディレクトリ名に実際のuserDefined:IDを使用（推測値ではない）
- meta.jsonも同時に作成（更新ではなく新規作成）

### Step 6.5: epic.mdにストーリー一覧を追記

```
1. `specs/epics/{EPIC_ID}-{title}/epic.md` を読み込み
2. 「## このエピックのストーリー」セクションを見つける
3. テンプレートのコメント行を削除
4. 各ストーリーについて以下の形式で追記:
   - [{userDefined:ID}](../stories/{userDefined:ID}-{title}/) - {summary}
   例: - [TC-S--8](../stories/TC-S--8-parent-task-creation-distribution/) - 親がタスクを作成・配布する画面...
5. epic.mdを保存
```

**重要な変更点**:
- epic-decomposerはepic.mdを生成するが、ストーリー一覧は空（テンプレートのコメントのみ）
- このステップでNotionから取得した実際のuserDefined:IDを使用してリンクを追記
- 各ストーリーのsummary（簡潔な要件概要）を含める（1-2行程度）

### Step 7: 結果表示

```
1. 完了メッセージを表示:
   - エピックID、タイトル
   - 生成されたストーリー数
   - 各ストーリーのURL
   - 実装順序の推奨

2. 次のアクションを案内:
   「各ストーリーの実装は以下のコマンドで開始できます：」
   /implement <ストーリーURL>
```

## エラーハンドリング

### エピックURL未指定

```
エラー検出時:
1. エラーメッセージを表示:
   ❌ エピックURLが指定されていません。

2. 使用例を提示:
   使用例:
   /epic-to-stories https://notion.so/DEBT-E-1-Authentication-System-abc123

3. 処理を中断
```

### 接続失敗

```
エラー検出時:
1. エラーメッセージを表示:
   ❌ エピック情報の取得に失敗しました。

2. 対処方法を案内:
   - .mcp.jsonの設定を確認してください
   - URLが正しいか確認してください

3. 処理を中断
```

### ユーザーがキャンセル

```
ユーザーが"no"を選択した場合:
1. キャンセルメッセージを表示:
   ⚠️ ストーリー分解をキャンセルしました。

2. 作成済みのディレクトリ構造を案内:
   以下のディレクトリは作成済みです：
   - specs/epics/{EPIC_ID}/
   - specs/stories/{STORY_ID}/

   ※ストーリーページは作成されていません。

3. 処理を終了
```

### 部分的成功（一部のストーリー作成失敗）

```
一部のストーリー作成に失敗した場合:
1. 警告メッセージを表示:
   ⚠️ 一部のストーリー作成に失敗しました。

2. 成功/失敗の詳細を表示:
   成功したストーリー (3件):
   - DEBT-S-0001: User Registration
   - DEBT-S-0002: User Login
   - DEBT-S-0003: Session Management

   失敗したストーリー (2件):
   - DEBT-S-0004: Password Reset (エラー: タイムアウト)
   - DEBT-S-0005: Email Verification (エラー: 認証失敗)

3. 対処方法を案内:
   失敗したストーリーは手動で作成するか、/epic-to-storiesコマンドを再実行してください。

4. 処理を完了（成功したストーリーは有効）
```

## 出力フォーマット

### 成功時の出力

```markdown
✅ エピック分解完了

**エピック情報**:
- エピックID: {EPIC_ID}
- タイトル: {タイトル}
- ディレクトリ: `specs/epics/{EPIC_ID}-{title}/`

**生成されたストーリー** ({N}件):
1. {STORY_ID}: {タイトル}
   - ディレクトリ: `specs/stories/{STORY_ID}-{title}/`
   - URL: {ストーリーURL}

2. {STORY_ID}: {タイトル}
   ...

**実装順序の推奨**:
1. {STORY_ID} - {理由}
2. {STORY_ID} - {理由}
3. {STORY_ID} - {理由}

**次のアクション**:
各ストーリーの実装は以下のコマンドで開始できます:
```
/implement {ストーリーURL}
```
```

### エラー時の出力

```markdown
❌ エピック分解失敗

**エラー内容**: {エラーメッセージ}

**対処方法**: {対処方法の説明}
```

## 使用例

### 基本的な使用例

```
入力:
/epic-to-stories https://notion.so/DEBT-E-1-Authentication-System-abc123

実行内容:
1. エピック情報取得（notion-client）
2. 5つのストーリーに分解（epic-decomposer）
3. ユーザー確認（承認）
4. 5つのストーリーページ作成（notion-client）
5. NotionからuserDefined:ID取得（notion-client）
6. 実際のIDでGitディレクトリとmeta.json作成
7. epic.mdにストーリー一覧を追記

出力:
✅ エピック分解完了

**エピック情報**:
- エピックID: DEBT-E-1
- タイトル: Authentication System
- ディレクトリ: `specs/epics/DEBT-E-1-authentication-system/`

**生成されたストーリー** (5件):
1. DEBT-S--1: User Registration
   - ディレクトリ: `specs/stories/DEBT-S--1-user-registration/`
   - URL: https://notion.so/DEBT-S--1

2. DEBT-S--2: User Login
   - ディレクトリ: `specs/stories/DEBT-S--2-user-login/`
   - URL: https://notion.so/DEBT-S--2

...

**実装順序の推奨**:
1. DEBT-S--1 - 基盤となるユーザー登録機能
2. DEBT-S--2 - ログイン機能（登録機能に依存）
3. DEBT-S--3 - セッション管理（ログイン機能に依存）
...

**次のアクション**:
各ストーリーの実装は以下のコマンドで開始できます:
```
/implement https://notion.so/DEBT-S-0001
```
```

### キャンセルの例

```
入力:
/epic-to-stories https://notion.so/DEBT-E-2-Payment-Integration-def456

実行内容:
1. エピック情報取得
2. 3つのストーリーに分解
3. ユーザー確認（拒否）

出力:
⚠️ ストーリー分解をキャンセルしました。

以下のディレクトリは作成済みです：
- specs/epics/DEBT-E-2-payment-integration/

※ストーリーページおよびストーリーディレクトリは作成されていません。

再度分解を実行する場合は、/epic-to-storiesコマンドを実行してください。
```

## 品質基準

### 必須条件
- [ ] エピックURLが正しく検証されること
- [ ] notion-client(fetch_epic)が正常に実行されること
- [ ] epic-decomposerが正常に実行されること（エピックディレクトリのみ作成）
- [ ] ユーザー確認が適切に動作すること（yes/no判定）
- [ ] notion-client(create_stories)が正常に実行されること
- [ ] notion-client(fetch_story)でuserDefined:IDが正しく取得されること
- [ ] 実際のuserDefined:IDでストーリーディレクトリが作成されること
- [ ] meta.jsonが正しく作成されること（実際のNotion情報を使用）
- [ ] epic.mdのストーリー一覧が正しく更新されること（実際のuserDefined:IDを使用）
- [ ] ストーリーURLリストが正しく表示されること

### 推奨条件
- [ ] エラーメッセージがわかりやすく、対処方法が明確であること
- [ ] 部分的成功時に成功/失敗の詳細が明示されること
- [ ] 次のアクション（/implementコマンド）が明確に案内されること

