/**
 * 実行メトリクス型定義
 *
 * Story 1-4の実行時に収集されるメトリクスデータの型定義。
 * Story 5のモニタリング・ロギング機能で集計・レポート生成に使用する。
 */

/**
 * 実行メトリクス
 *
 * 各処理フェーズで収集されるメトリクスを集約する。
 */
export interface ExecutionMetrics {
  /**
   * Dify APIから取得したレコード数（Story 2）
   *
   * Dify Usage APIからフェッチした使用量レコードの総数。
   */
  fetchedRecords: number

  /**
   * 変換完了したレコード数（Story 3）
   *
   * Transformerで変換が完了したレコード数。
   * fetchedRecords - transformedRecordsが変換エラー数となる。
   */
  transformedRecords: number

  /**
   * 送信成功数（Story 4）
   *
   * 外部APIへの送信が成功したレコード数。
   * 409 Conflictレスポンス（重複検出）も成功扱いとしてカウントする。
   */
  sendSuccess: number

  /**
   * 送信失敗数（Story 4）
   *
   * リトライ上限到達により送信が失敗したレコード数。
   * スプール保存されたレコードはこのカウントに含まれる。
   */
  sendFailed: number

  /**
   * スプール保存数（Story 4）
   *
   * リトライ上限到達によりdata/spool/へ保存されたバッチ数。
   */
  spoolSaved: number

  /**
   * スプール再送成功数（Story 4）
   *
   * data/spool/からの再送が成功したバッチ数。
   */
  spoolResendSuccess: number

  /**
   * data/failed/移動数（Story 4）
   *
   * リトライ上限超過によりdata/failed/へ移動されたバッチ数。
   */
  failedMoved: number
}
