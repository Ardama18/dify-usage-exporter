---
story_id: 4
title: external-api-sender
epic_id: 1
type: phase-completion
feature: external-api-sender
phase: 2
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# Phase 2完了確認: スプール管理層

## フェーズ概要
- **目的**: data/spool/、data/failed/へのファイル保存・読み込み・削除機能
- **期間**: 2-3日

## 完了タスク一覧
- [x] Task 2-1: ファイル操作ユーティリティ実装（phase2-001-file-utils-implementation.md）
- [x] Task 2-2: SpoolManagerクラス実装（phase2-002-spool-manager-implementation.md）

## plan.mdチェックボックス確認

### フェーズ完了条件
- [ ] スプールファイルが正しく保存される（パーミッション600）
- [ ] firstAttempt昇順でソートされる
- [ ] 破損ファイルがdata/failed/へ移動される
- [ ] 単体テストがすべてパス

## 次フェーズへの引き継ぎ
- **成果物**:
  - src/utils/file-utils.ts
  - src/sender/spool-manager.ts
- **Phase 3への依存**: SpoolManagerがSenderで統合される

## 動作確認（L2）
```bash
cd backend
# テストデータ（ExternalApiRecord[]）を作成
# SpoolManager.saveToSpool()を実行
# data/spool/にファイルが作成されているか確認
ls -l data/spool/  # パーミッション600を確認
# SpoolManager.listSpoolFiles()で読み込み確認
npm run test:unit -- src/sender/__tests__/spool-manager.test.ts
```
