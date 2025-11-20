---
id: 4
feature: external-api-sender
type: adr
version: 1.0.0
created: 2025-11-18
based_on: specs/stories/4-external-api-sender/prd.md
---

# ADR 007: HTTPクライアントライブラリ

## ステータス

Accepted

## コンテキスト

外部APIへのHTTPS POST送信を行うため、HTTPクライアントライブラリを選択する必要がある。以下の要件を考慮する：

- **リトライ機構**: 指数バックオフによる自動リトライ
- **認証**: Bearerトークン認証
- **タイムアウト**: 30秒のタイムアウト設定
- **インターセプター**: ログ出力、トークンマスク処理
- **TypeScript対応**: 型安全性の確保
- **Epic共通の技術スタック**: 一貫性の確保

## 決定事項

**axios + axios-retryを採用する。**

- **HTTPクライアント**: axios 1.x
- **リトライ機構**: axios-retry 3.x
- **インターセプター**: axiosの標準機能を使用
- **Epic共通**: Epic方針書で定義された技術スタック

## 根拠

### 検討した選択肢

#### 1. axios + axios-retry（採用）
- **説明**: axiosとaxios-retryを組み合わせて使用
- **利点**:
  - **Epic共通の技術スタック**: Epic方針書で定義された標準ライブラリ（一貫性）
  - **axios-retryの成熟度**: 指数バックオフの標準実装、豊富な設定オプション
  - **インターセプター機能**: リクエスト/レスポンスの加工が容易（ログ、トークンマスク）
  - **TypeScript対応**: 型定義ファイルが充実
  - **豊富な実績**: 広く使われており、トラブルシューティング情報が豊富
  - **柔軟な設定**: タイムアウト、ヘッダー、リトライ条件など細かく設定可能
- **欠点**:
  - axios-retryの追加依存（1ライブラリ追加）
  - axiosの依存関係が多い（パッケージサイズが大きい）

#### 2. node-fetch + カスタムリトライ
- **説明**: node-fetchを使用し、リトライ処理を自前で実装
- **利点**:
  - 軽量（依存関係が少ない）
  - ブラウザのfetch APIと互換性が高い
  - カスタムリトライで柔軟な制御が可能
- **欠点**:
  - リトライ処理を自前で実装する必要がある（実装コスト高）
  - 指数バックオフの実装が複雑
  - インターセプター機能がない（ログ、トークンマスクを自前で実装）
  - Epic共通の技術スタックではない（一貫性なし）
  - エラーハンドリングが煩雑（axios-retryより低レベル）

#### 3. got（リトライ内蔵）
- **説明**: gotライブラリ（リトライ機能が組み込まれている）
- **利点**:
  - リトライ機能が標準搭載（追加ライブラリ不要）
  - TypeScript型定義が優れている（axiosより型安全）
  - Promise APIがシンプル
  - ストリーミング対応
- **欠点**:
  - Epic共通の技術スタックではない（一貫性なし）
  - インターセプター機能がaxiosより弱い
  - axiosよりコミュニティが小さい（トラブルシューティング情報が少ない）
  - リトライ設定の柔軟性がaxios-retryより低い

### 選択理由

**axios + axios-retryを選択した理由:**

1. **Epic共通の技術スタック（最優先）**
   - Epic方針書（`specs/epics/1-dify-usage-exporter/epic.md`）で定義された標準ライブラリ
   - 全ストーリーで同じHTTPクライアントを使用（一貫性）
   - 他のストーリー（Story 2、Story 3）でも同じaxiosを使用
   - コードレビュー、トラブルシューティングが容易

2. **axios-retryの成熟度**
   - 指数バックオフの標準実装（`exponentialDelay`関数）
   - 豊富な設定オプション（`retryCondition`、`retryDelay`、`shouldResetTimeout`）
   - 広く使われており、実績が豊富
   - 2025年時点でもアクティブにメンテナンス

3. **インターセプター機能**
   - リクエストインターセプター: Bearerトークン追加、ログ出力
   - レスポンスインターセプター: トークンマスク、エラーログ出力
   - 一元的な前処理・後処理が可能

4. **TypeScript対応**
   - 型定義ファイルが充実（`@types/axios`）
   - axios-retryもTypeScript対応
   - 型安全性の確保

5. **豊富な実績とコミュニティ**
   - npm週間ダウンロード数: axios 4000万+、axios-retry 100万+
   - Stack Overflow、GitHub Issuesでのトラブルシューティング情報が豊富
   - ドキュメントが充実

### トレードオフの受容

**受け入れるトレードオフ:**
- axios-retryの追加依存（1ライブラリ追加）
  - **軽減策**: Epic共通の技術スタックなので、既に依存関係に含まれている可能性
  - **判断**: リトライ機構の実装コスト削減のメリットが、依存関係増加のデメリットを上回る

- axiosの依存関係が多い（パッケージサイズが大きい）
  - **軽減策**: 現代のNode.js環境ではパッケージサイズは問題にならない
  - **判断**: 機能の豊富さと実績が、パッケージサイズのデメリットを上回る

- gotの方がTypeScript型定義が優れている
  - **軽減策**: axiosの型定義も十分に充実
  - **判断**: Epic共通の技術スタックとの一貫性を優先

## 影響

### ポジティブな影響

- **実装コスト削減**: axios-retryで指数バックオフが標準実装
- **Epic全体の一貫性**: 全ストーリーで同じHTTPクライアント使用
- **保守性の向上**: 豊富な実績とコミュニティサポート
- **インターセプター活用**: ログ、トークンマスク処理が容易
- **型安全性**: TypeScript対応で型エラーを防止

### ネガティブな影響

- **依存関係の増加**: axios-retry追加（ただしEpic共通）
- **パッケージサイズ**: axiosは依存関係が多い（ただし現代のNode.js環境では問題なし）

### 中立的な影響

- **学習コスト**: axiosとaxios-retryの使い方を学ぶ必要がある（ただし広く使われており、学習リソースが豊富）

## 実装への指針

### 原則

1. **axios-retryの設定**
   ```typescript
   import axios from 'axios'
   import axiosRetry from 'axios-retry'

   const client = axios.create({
     baseURL: process.env.EXTERNAL_API_ENDPOINT,
     timeout: Number(process.env.EXTERNAL_API_TIMEOUT_MS) || 30000,
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${process.env.EXTERNAL_API_TOKEN}`,
       'User-Agent': 'dify-usage-exporter/1.0.0'
     }
   })

   axiosRetry(client, {
     retries: Number(process.env.MAX_RETRIES) || 3,
     retryDelay: axiosRetry.exponentialDelay,
     retryCondition: (error) => {
       return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
         (error.response?.status >= 500) ||
         (error.response?.status === 429)
     }
   })
   ```

2. **インターセプターの使用**
   - リクエストインターセプター: ログ出力（トークンマスク済み）
   - レスポンスインターセプター: エラーログ出力、409レスポンスの処理

3. **環境変数での設定**
   - `EXTERNAL_API_ENDPOINT`: 外部APIエンドポイント
   - `EXTERNAL_API_TOKEN`: 認証トークン
   - `EXTERNAL_API_TIMEOUT_MS`: タイムアウト時間（デフォルト30000）
   - `MAX_RETRIES`: 最大リトライ回数（デフォルト3）

4. **エラーハンドリング**
   - axiosのエラーは`AxiosError`型で受け取る
   - `error.response`、`error.request`、`error.message`でエラー内容を判別

5. **構造化ログ出力**
   - リクエスト/レスポンスの内容をJSON形式でログ出力
   - トークンはマスク処理（`Bearer ***MASKED***`）

## 参考資料

- [axios npm package](https://www.npmjs.com/package/axios) - 公式ドキュメント
- [axios-retry npm package](https://www.npmjs.com/package/axios-retry) - 公式ドキュメント
- [Axios Retry Best Practices (ZenRows, 2025)](https://www.zenrows.com/blog/axios-retry) - 実装パターン
- [Mastering Axios Retry (iProyal, 2025)](https://iproyal.com/blog/axios-retry-requests/) - 実装例

## 関連情報

- Epic方針書: `specs/epics/1-dify-usage-exporter/epic.md`
- PRD: `specs/stories/4-external-api-sender/prd.md`
- 関連ADR:
  - ADR 002: リトライポリシー（指数バックオフの詳細）
  - ADR 005: Retry-Afterヘッダ対応（axios-retryでの実装方針）
