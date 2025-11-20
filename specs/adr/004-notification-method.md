---
id: 4
feature: external-api-sender
type: adr
version: 1.0.0
created: 2025-11-18
based_on: specs/stories/4-external-api-sender/prd.md
---

# ADR 004: 通知方法

## ステータス

Accepted

## コンテキスト

スプールリトライ上限超過時（`data/failed/`へ移動）に、運用担当者へエラー通知を送信する必要がある。通知方法の選択肢として、Slack Webhook、メール、その他の通知チャネルが考えられる。

現在の要件では、以下の考慮事項がある：
- **関心の分離**: 通知手段の選択は、送信処理とは独立した責務
- **柔軟性**: 将来的に通知チャネルを追加・変更する可能性
- **Story依存関係**: Story 5（monitoring-logging-healthcheck）で通知機構を一元管理

## 決定事項

**INotifierインターフェースで抽象化し、実装はStory 5に委譲する。**

- **抽象化**: `INotifier`インターフェースを定義し、通知手段に依存しない設計
- **実装委譲**: 具体的な通知実装（Slack/メール）はStory 5で一元管理
- **Story 4の責務**: INotifierインターフェースの定義と呼び出しのみ
- **Story 5の責務**: INotifierの具体実装（SlackNotifier、EmailNotifier等）

## 根拠

### 検討した選択肢

#### 1. Slack Webhookのみ
- **説明**: Slack Webhook APIを直接呼び出す
- **利点**:
  - 実装が非常にシンプル（axios POSTのみ）
  - リアルタイム通知が可能
  - 運用チームが既に使用している可能性が高い
  - コストゼロ（Slack既存契約）
- **欠点**:
  - Slack依存が固定化される（他の通知手段への切り替えが困難）
  - Slackが利用できない環境では機能しない
  - 通知履歴がSlackに依存（検索・保存の制約）
  - 通知の柔軟性が低い（フォーマット固定）

#### 2. メールのみ
- **説明**: nodemailerを使用してメール送信
- **利点**:
  - 普遍的な通知手段（ほぼ全ての環境で利用可能）
  - 通知履歴がメールボックスに永続化
  - 複数の宛先への送信が容易
  - 公式的な記録として残る
- **欠点**:
  - リアルタイム性が低い（メール受信までのラグ）
  - SMTP設定が必要（環境構築の複雑性）
  - スパムフィルタに引っかかるリスク
  - 運用チームがメールを見逃す可能性

#### 3. 両方（Slack + メール）
- **説明**: Slackとメールの両方に通知を送信
- **利点**:
  - 冗長性が高い（片方が失敗しても、もう片方で通知）
  - リアルタイム性（Slack）と永続性（メール）の両立
  - 運用チームの好みに応じて選択可能
- **欠点**:
  - 実装コストが高い（両方の実装が必要）
  - 通知の重複（運用チームが2回通知を受ける）
  - 両方のメンテナンスが必要
  - Story 4の責務が肥大化

#### 4. INotifierインターフェースで抽象化（採用）
- **説明**: INotifierインターフェースを定義し、実装をStory 5に委譲
- **利点**:
  - **関心の分離**: 送信処理（Story 4）と通知手段（Story 5）の責務を分離
  - **柔軟性**: 通知手段の追加・変更が容易（インターフェース実装のみ）
  - **一元管理**: Story 5で全ての通知実装を管理（重複排除）
  - **テスタビリティ**: モックNotifierで通知なしでテスト可能
  - **依存性注入**: Senderは通知手段を知る必要がない
- **欠点**:
  - 実装が2つのStoryに分散（Story 4: インターフェース定義、Story 5: 実装）
  - Story 5がブロッカーになる（通知が送信されるのはStory 5完了後）
  - インターフェース設計の複雑性（将来の拡張を見越した設計が必要）

### 選択理由

**INotifierインターフェースで抽象化を選択した理由:**

1. **関心の分離（最優先）**
   - 送信処理（Sender）は「何を通知するか」のみを知る
   - 通知手段（Slack/メール）は「どう通知するか」を知る
   - 責務が明確に分離され、保守性が向上

2. **Story 5との連携**
   - Story 5（monitoring-logging-healthcheck）で通知機構を一元管理
   - 他のストーリー（Story 2、Story 3）でも同じINotifierを使用
   - 通知実装の重複を排除

3. **柔軟性の確保**
   - 将来的にSlack以外の通知手段（PagerDuty、LINE、Discord等）を追加可能
   - 通知手段の変更がSenderに影響しない
   - 環境ごとに異なる通知手段を選択可能（開発環境: ログのみ、本番環境: Slack+メール）

4. **テスタビリティ**
   - モックNotifierで通知なしでテスト可能
   - 単体テストで通知の副作用を排除
   - 統合テストで実際の通知をテスト

5. **依存性注入**
   - SenderはINotifierインターフェースに依存
   - 具体的な通知実装（SlackNotifier、EmailNotifier）には依存しない
   - 疎結合な設計

### トレードオフの受容

**受け入れるトレードオフ:**
- 実装が2つのStoryに分散する
  - **軽減策**: インターフェース定義を明確にし、Story 5の実装を容易にする
  - **判断**: 責務の分離と一元管理のメリットが、実装分散のデメリットを上回る

- Story 5がブロッカーになる（通知が送信されるのはStory 5完了後）
  - **軽減策**: Story 4の実装時はモックNotifierで代替、Story 5完了後に実装を差し替え
  - **判断**: 段階的な実装が可能、Story 4の開発に影響しない

- インターフェース設計の複雑性
  - **軽減策**: シンプルなインターフェース定義（`sendErrorNotification(message)`のみ）
  - **判断**: 将来の拡張余地を残しつつ、現在の要件に適合するインターフェース

## 影響

### ポジティブな影響

- **保守性の向上**: 送信処理と通知手段の責務が分離され、変更が容易
- **柔軟性の確保**: 通知手段の追加・変更が実装の差し替えのみで対応可能
- **テスタビリティ**: モックNotifierで通知なしでテスト可能
- **一元管理**: Story 5で全ての通知実装を管理、重複排除
- **疎結合**: Senderは通知手段に依存しない

### ネガティブな影響

- **実装の分散**: Story 4（インターフェース）とStory 5（実装）に分散
- **Story依存**: Story 5完了まで通知機能が完成しない
- **インターフェース設計**: 将来の拡張を見越した設計が必要

### 中立的な影響

- **モックNotifierの使用**: Story 4の開発時は仮実装が必要
- **Story 5の実装コスト**: 通知実装（Slack/メール）のコストはStory 5に移譲

## 実装への指針

### 原則

1. **INotifierインターフェース定義**
   ```typescript
   export interface INotifier {
     sendErrorNotification(message: ErrorNotificationMessage): Promise<void>
   }

   export interface ErrorNotificationMessage {
     title: string
     filePath: string
     lastError: string
     firstAttempt: string
     retryCount: number
   }
   ```

2. **依存性注入**
   - SenderクラスのコンストラクタでINotifierを受け取る
   - 具体的な実装（SlackNotifier、EmailNotifier）には依存しない

3. **モックNotifierの使用**
   - Story 4の開発時は`ConsoleNotifier`（ログのみ）で代替
   - Story 5完了後に実装を差し替え

4. **エラーハンドリング**
   - 通知送信失敗時もエラーを握りつぶさない
   - ログに通知失敗を記録し、処理は継続（通知失敗で処理全体を停止しない）

5. **Story 5との連携**
   - INotifierインターフェースをStory 5に引き継ぎ
   - Story 5でSlackNotifier、EmailNotifierを実装

## 参考資料

- [Dependency Inversion Principle (SOLID)](https://en.wikipedia.org/wiki/Dependency_inversion_principle) - 依存性逆転の原則
- [Interface Segregation Principle (SOLID)](https://en.wikipedia.org/wiki/Interface_segregation_principle) - インターフェース分離の原則

## 関連情報

- Epic方針書: `specs/epics/1-dify-usage-exporter/epic.md`
- PRD: `specs/stories/4-external-api-sender/prd.md`
- 関連ADR:
  - Story 5 ADR（予定）: 通知実装の詳細（Slack/メール）
