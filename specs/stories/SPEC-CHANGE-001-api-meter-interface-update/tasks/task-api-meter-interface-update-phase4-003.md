---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 011
phase: 4
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: API_Meter Sandbox環境でのテスト

メタ情報:
- 依存: task-api-meter-interface-update-phase4-002 → 成果物: test/integration/api-meter-integration.int.test.ts
- 提供: Sandbox環境での動作確認完了
- サイズ: 小規模（手動テスト）

## 実装内容

実際のAPI_Meter Sandbox環境へ接続し、送信テストを実施します。

### テスト項目
1. API_Meter Sandbox環境への接続設定
2. per_modelモードでの送信テスト
3. allモードでの送信テスト
4. 200 OKレスポンスの確認
5. API_Meter管理画面でのデータ確認
6. エラーケースのテスト（401, 400, 429）

## 実施手順

### 1. 環境変数設定
```bash
# .env
API_METER_TENANT_ID=<sandbox-tenant-id>
API_METER_TOKEN=<sandbox-token>
API_METER_URL=https://sandbox.api-meter.example.com
```

### 2. per_modelモードでの送信テスト
```bash
npm run start -- --mode per_model --date 2025-12-05
```

### 3. 送信データの確認
- [ ] 200 OKレスポンスを受信
- [ ] inserted/updatedカウントを確認
- [ ] API_Meter管理画面でデータ表示を確認
- [ ] 送信データとAPI_Meter表示データの一致確認

### 4. エラーケースのテスト
- [ ] 不正なトークンでの送信（401 Unauthorized）
- [ ] 不正なデータでの送信（400 Bad Request）
- [ ] Rate Limitテスト（429 Too Many Requests）

## 完了条件

- [ ] API_Meter Sandbox環境へ正常に送信できる
- [ ] 200 OKレスポンスを受信する
- [ ] API_Meter管理画面でデータが表示される
- [ ] 送信データとAPI_Meter表示データが一致する
- [ ] L3（E2E・実機テスト）レベルの確認完了

## 参考資料

- [API_Meter API Documentation](https://api-meter.example.com/docs)
- [API_Meter Authentication Guide](https://api-meter.example.com/docs/auth)
