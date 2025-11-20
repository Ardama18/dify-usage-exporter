# インフラストラクチャテストガイドライン

AWS CDKインフラコードのテスト戦略。Unit、Snapshot、Integration、Security、Complianceテストを網羅し、高品質なインフラを保証する。

## 関連ドキュメント

このドキュメントはAWSインフラの**テスト・検証フェーズ**で使用します。

**関連ステアリングファイル**:
- **infrastructure-requirements.md**: テストで検証すべきAWS Well-Architected要件
- **cdk-best-practices.md**: テスト対象となるCDK実装パターン

**テスト実行順序**:
1. **Unit Test**: CDKスタック生成検証（本ファイル参照）
2. **Snapshot Test**: CloudFormation構成変更検出（本ファイル参照）
3. **Security Test**: cfn-nag, cdk-nag実行（本ファイル参照）
4. **Compliance Test**: タグ・命名規約検証（本ファイル参照）
5. **Integration Test**: 実環境デプロイ検証（本ファイル参照）

**チェックリスト連携**:
- infrastructure-requirements.md の必須項目 → cdk-best-practices.md で実装 → 本ファイルのテストケースで検証

**エージェント使用**:
- テスト・検証: **infrastructure-validator** エージェント（本ファイル参照）
- 自動修正: **infrastructure-validator** が検出したエラーを自動修正

## テスト戦略概要

### テストピラミッド（インフラ版）

```
         △
        /E2E\          少ない・遅い・高コスト
       /─────\         → 本番環境での検証
      /Security\       → cfn-nag, GuardDuty
     /─────────\
    / Integration\     中程度
   /───────────\       → 実環境デプロイ検証
  /   Snapshot    \    → 構成変更検出
 /─────────────\
/   Unit Tests     \   多い・速い・低コスト
───────────────   → スタック生成検証
```

### テストレベルと目的

| レベル | 目的 | 実行頻度 | 所要時間 | ツール |
|--------|------|---------|---------|--------|
| Unit | リソース生成検証 | コミット毎 | 秒単位 | Jest + CDK assertions |
| Snapshot | 構成変更検出 | コミット毎 | 秒単位 | Jest snapshots |
| Integration | 実環境動作確認 | PR毎 | 分単位 | AWS SDK + Jest |
| Security | 脆弱性検出 | PR毎 | 分単位 | cfn-nag, cdk-nag |
| Compliance | コンプライアンス検証 | PR毎 | 分単位 | OPA, custom rules |
| E2E | エンドツーエンド検証 | デプロイ前 | 時間単位 | Playwright, Postman |

## Unit Test

### 基本パターン

```typescript
// test/unit/network-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../../lib/stacks/network-stack';

describe('NetworkStack', () => {
  let app: App;
  let template: Template;

  beforeEach(() => {
    app = new App();
    const stack = new NetworkStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    template = Template.fromStack(stack);
  });

  test('VPC is created with correct CIDR', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });
  });

  test('VPC has 6 subnets (Public x2, Private x2, Data x2)', () => {
    template.resourceCountIs('AWS::EC2::Subnet', 6);
  });

  test('NAT Gateways are in Public Subnets', () => {
    template.hasResourceProperties('AWS::EC2::NatGateway', {
      SubnetId: Match.anyValue(),
    });
    template.resourceCountIs('AWS::EC2::NatGateway', 2); // Multi-AZ
  });

  test('Security Group blocks all inbound by default', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.absent(), // デフォルトで空
    });
  });
});
```

### 高度なアサーション

```typescript
import { Capture, Match } from 'aws-cdk-lib/assertions';

test('Lambda has correct IAM permissions', () => {
  // IAMロールのARNをキャプチャ
  const roleCapture = new Capture();
  template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Principal: { Service: 'lambda.amazonaws.com' },
        }),
      ]),
    }),
  });

  // キャプチャしたロールが正しくLambdaに割り当てられているか
  template.hasResourceProperties('AWS::Lambda::Function', {
    Role: Match.anyValue(),
  });
});

test('RDS instance uses encrypted storage', () => {
  template.hasResourceProperties('AWS::RDS::DBInstance', {
    StorageEncrypted: true,
    KmsKeyId: Match.anyValue(), // KMSキーが設定されている
  });
});

test('S3 Bucket enforces SSL', () => {
  template.hasResourceProperties('AWS::S3::BucketPolicy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Condition: {
            Bool: { 'aws:SecureTransport': 'false' },
          },
        }),
      ]),
    },
  });
});
```

### カスタムConstructのテスト

```typescript
// test/unit/monitored-lambda.test.ts
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Code } from 'aws-cdk-lib/aws-lambda';
import { MonitoredLambda } from '../../lib/constructs/monitored-lambda';

describe('MonitoredLambda', () => {
  test('creates Lambda with monitoring', () => {
    const stack = new Stack();
    new MonitoredLambda(stack, 'TestLambda', {
      functionName: 'test-function',
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = () => {}'),
      alarmEmail: 'test@example.com',
    });

    const template = Template.fromStack(stack);

    // Lambda関数が作成される
    template.resourceCountIs('AWS::Lambda::Function', 1);

    // CloudWatch Alarmが作成される
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Errors',
      Threshold: 10,
    });

    // SNS Topicが作成される
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.resourceCountIs('AWS::SNS::Subscription', 1);
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'test@example.com',
    });

    // Log Groupが作成される
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/test-function',
      RetentionInDays: 30,
    });
  });
});
```

## Snapshot Test

### 基本的なSnapshot Test

```typescript
// test/snapshot/stacks.snapshot.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../../lib/stacks/network-stack';
import { ComputeStack } from '../../lib/stacks/compute-stack';

describe('Stack Snapshots', () => {
  test('NetworkStack matches snapshot', () => {
    const app = new App();
    const stack = new NetworkStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    expect(template.toJSON()).toMatchSnapshot();
  });

  test('ComputeStack matches snapshot', () => {
    const app = new App();
    const networkStack = new NetworkStack(app, 'NetworkStack');
    const computeStack = new ComputeStack(app, 'ComputeStack', {
      vpc: networkStack.vpc,
    });
    const template = Template.fromStack(computeStack);

    expect(template.toJSON()).toMatchSnapshot();
  });
});
```

### Snapshot更新フロー

```bash
# 初回実行: スナップショット作成
npm test

# コード変更後: 差分検出
npm test
# → FAIL: スナップショットと一致しない

# 意図的な変更の場合: スナップショット更新
npm test -- -u

# 変更内容をGit diffで確認
git diff test/**/__snapshots__/
```

### Snapshot Test活用シーン

1. **リファクタリング検証**: 動作変更なしの確認
2. **CDKバージョンアップ**: 生成されるCloudFormation変更検出
3. **依存ライブラリ更新**: 副作用の検出
4. **レビュープロセス**: PR差分として可視化

## Integration Test

### 実環境デプロイ検証

```typescript
// test/integration/api-stack.integration.test.ts
import * as AWS from 'aws-sdk';
import axios from 'axios';

describe('API Stack Integration', () => {
  const apiUrl = process.env.API_URL!; // CDK出力から取得
  const tableName = process.env.TABLE_NAME!;

  test('API returns 200 on health check', async () => {
    const response = await axios.get(`${apiUrl}/health`);
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'healthy');
  }, 30000); // タイムアウト30秒

  test('DynamoDB table exists and is active', async () => {
    const dynamodb = new AWS.DynamoDB({ region: 'ap-northeast-1' });
    const result = await dynamodb.describeTable({ TableName: tableName }).promise();

    expect(result.Table?.TableStatus).toBe('ACTIVE');
    expect(result.Table?.BillingModeSummary?.BillingMode).toBe('PAY_PER_REQUEST');
  });

  test('Lambda can write to DynamoDB', async () => {
    const payload = { message: 'test' };
    const response = await axios.post(`${apiUrl}/items`, payload);

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('id');

    // 書き込まれたデータを確認
    const docClient = new AWS.DynamoDB.DocumentClient({ region: 'ap-northeast-1' });
    const result = await docClient.get({
      TableName: tableName,
      Key: { id: response.data.id },
    }).promise();

    expect(result.Item).toMatchObject(payload);
  }, 60000);

  test('CloudWatch Logs are being created', async () => {
    const logs = new AWS.CloudWatchLogs({ region: 'ap-northeast-1' });
    const logGroupName = `/aws/lambda/${process.env.FUNCTION_NAME}`;

    const logStreams = await logs.describeLogStreams({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1,
    }).promise();

    expect(logStreams.logStreams).toHaveLength(1);
  });
});
```

### CI/CDでのIntegration Test実行

```yaml
# .github/workflows/integration-test.yml
name: Integration Tests

on:
  pull_request:
    branches: [main]

jobs:
  integration-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Deploy test stack
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          npx cdk deploy TestStack --require-approval never --outputs-file outputs.json

      - name: Run integration tests
        env:
          API_URL: $(cat outputs.json | jq -r '.TestStack.ApiUrl')
          TABLE_NAME: $(cat outputs.json | jq -r '.TestStack.TableName')
        run: npm run test:integration

      - name: Destroy test stack
        if: always()
        run: npx cdk destroy TestStack --force
```

## Security Test

### cfn-nag（CloudFormation静的解析）

**インストール**:
```bash
gem install cfn-nag
```

**実行**:
```bash
# CDKからCloudFormationテンプレート生成
npx cdk synth --all

# cfn-nag実行
cfn-nag_scan --input-path cdk.out/

# 特定のルール無効化（正当な理由がある場合のみ）
cfn-nag_scan --input-path cdk.out/ \
  --deny-list-path .cfn-nag-deny-list.yml
```

**カスタムルール無効化**:
```yaml
# .cfn-nag-deny-list.yml
RulesToSuppress:
  - id: W58
    reason: "Lambda実行ロールにCloudWatch Logs書き込み権限がない"
    # → 実際は権限があるが、cfn-nagが検出できない場合
```

**Jest統合**:
```typescript
// test/security/cfn-nag.test.ts
import { execSync } from 'child_process';

describe('CloudFormation Security', () => {
  beforeAll(() => {
    // CDK Synth実行
    execSync('npx cdk synth --all', { stdio: 'inherit' });
  });

  test('cfn-nag passes with no violations', () => {
    try {
      execSync('cfn-nag_scan --input-path cdk.out/', { stdio: 'inherit' });
    } catch (error) {
      fail('cfn-nag found security violations');
    }
  });
});
```

### cdk-nag（CDKネイティブ静的解析）

**インストール**:
```bash
npm install --save-dev cdk-nag
```

**実装**:
```typescript
// bin/app.ts
import { App, Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';

const app = new App();

// AWS Solutions チェック適用
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

const stack = new MyStack(app, 'MyStack');

// 特定のルール抑制（正当な理由を記載）
NagSuppressions.addStackSuppressions(stack, [
  {
    id: 'AwsSolutions-IAM4',
    reason: 'AWSLambdaBasicExecutionRoleは標準的な管理ポリシー',
  },
  {
    id: 'AwsSolutions-S3-1',
    reason: '内部ログバケットのためアクセスログ不要',
  },
]);

// リソース単位での抑制
NagSuppressions.addResourceSuppressions(myLambda, [
  {
    id: 'AwsSolutions-L1',
    reason: 'Node.js 20.xは最新のLTS',
  },
]);
```

### カスタムセキュリティルール

```typescript
// test/security/custom-rules.test.ts
import { Template } from 'aws-cdk-lib/assertions';

describe('Custom Security Rules', () => {
  test('All Lambda functions have reserved concurrency', () => {
    const template = Template.fromStack(stack);
    const lambdas = template.findResources('AWS::Lambda::Function');

    Object.values(lambdas).forEach((lambda) => {
      expect(lambda.Properties).toHaveProperty('ReservedConcurrentExecutions');
    });
  });

  test('All S3 buckets have lifecycle policies', () => {
    const template = Template.fromStack(stack);
    const buckets = template.findResources('AWS::S3::Bucket');

    Object.values(buckets).forEach((bucket) => {
      expect(bucket.Properties).toHaveProperty('LifecycleConfiguration');
    });
  });

  test('All RDS instances are in Multi-AZ', () => {
    const template = Template.fromStack(stack);
    const rds = template.findResources('AWS::RDS::DBInstance');

    Object.values(rds).forEach((instance) => {
      expect(instance.Properties.MultiAZ).toBe(true);
    });
  });

  test('No security groups allow 0.0.0.0/0 on ports other than 80/443', () => {
    const template = Template.fromStack(stack);
    const securityGroups = template.findResources('AWS::EC2::SecurityGroup');

    Object.values(securityGroups).forEach((sg) => {
      const ingress = sg.Properties.SecurityGroupIngress || [];
      ingress.forEach((rule: any) => {
        if (rule.CidrIp === '0.0.0.0/0') {
          expect([80, 443]).toContain(rule.FromPort);
        }
      });
    });
  });
});
```

### カスタムSustainabilityルール【2024年11月追加】

```typescript
// test/security/sustainability-rules.test.ts
import { Template } from 'aws-cdk-lib/assertions';

describe('Sustainability Rules (Well-Architected Framework 6th Pillar)', () => {
  test('All Lambda functions use Graviton (arm64) architecture', () => {
    const template = Template.fromStack(stack);
    const lambdas = template.findResources('AWS::Lambda::Function');

    Object.values(lambdas).forEach((lambda) => {
      // arm64アーキテクチャの使用を推奨（省エネ・高パフォーマンス）
      const architectures = lambda.Properties.Architectures;
      if (architectures) {
        expect(architectures).toContain('arm64');
      }
    });
  });

  test('All ECS Task Definitions use Graviton (ARM64) architecture', () => {
    const template = Template.fromStack(stack);
    const taskDefs = template.findResources('AWS::ECS::TaskDefinition');

    Object.values(taskDefs).forEach((taskDef) => {
      const runtimePlatform = taskDef.Properties.RuntimePlatform;
      if (runtimePlatform) {
        expect(runtimePlatform.CpuArchitecture).toBe('ARM64');
      }
    });
  });

  test('All RDS instances use Graviton instance classes (r7g, m7g, t4g)', () => {
    const template = Template.fromStack(stack);
    const rdsInstances = template.findResources('AWS::RDS::DBInstance');

    Object.values(rdsInstances).forEach((instance) => {
      const instanceClass = instance.Properties.DBInstanceClass;
      // Gravitonインスタンスクラス: r7g, m7g, t4g
      const isGraviton = /\.(r7g|m7g|t4g)\./.test(instanceClass);
      expect(isGraviton).toBe(true);
    });
  });

  test('Development environment has auto-shutdown configured', () => {
    const template = Template.fromStack(devStack);
    const rules = template.findResources('AWS::Events::Rule');

    // EventBridge Ruleで自動停止/起動が設定されているか
    const autoShutdownRules = Object.values(rules).filter((rule: any) => {
      const scheduleExpression = rule.Properties.ScheduleExpression;
      return scheduleExpression && scheduleExpression.includes('cron');
    });

    expect(autoShutdownRules.length).toBeGreaterThan(0);
  });

  test('All S3 buckets have lifecycle policies for cost and sustainability', () => {
    const template = Template.fromStack(stack);
    const buckets = template.findResources('AWS::S3::Bucket');

    Object.values(buckets).forEach((bucket) => {
      expect(bucket.Properties).toHaveProperty('LifecycleConfiguration');

      const rules = bucket.Properties.LifecycleConfiguration.Rules;
      // Glacier移行ルールが存在するか
      const hasGlacierTransition = rules.some((rule: any) =>
        rule.Transitions?.some((t: any) =>
          t.StorageClass === 'GLACIER' || t.StorageClass === 'DEEP_ARCHIVE'
        )
      );
      expect(hasGlacierTransition).toBe(true);
    });
  });

  test('CPU utilization target is set for efficient resource usage', () => {
    const template = Template.fromStack(stack);
    const scalingPolicies = template.findResources('AWS::ApplicationAutoScaling::ScalingPolicy');

    Object.values(scalingPolicies).forEach((policy) => {
      const targetTracking = policy.Properties.TargetTrackingScalingPolicyConfiguration;
      if (targetTracking && targetTracking.PredefinedMetricSpecification?.PredefinedMetricType === 'ECSServiceAverageCPUUtilization') {
        // CPU使用率目標が50%以上（アイドルリソース削減）
        expect(targetTracking.TargetValue).toBeGreaterThanOrEqual(50);
      }
    });
  });
});
```

## Compliance Test

### OPA（Open Policy Agent）統合

**ポリシー定義**:
```rego
# policies/tagging.rego
package aws.tagging

required_tags := ["Environment", "Project", "Owner"]

violation[{"msg": msg, "resource": resource}] {
  resource := input.resources[_]
  resource.Type == "AWS::S3::Bucket"
  tags := resource.Properties.Tags
  missing_tag := required_tags[_]
  not tag_exists(tags, missing_tag)
  msg := sprintf("Missing required tag: %s", [missing_tag])
}

tag_exists(tags, key) {
  tags[_].Key == key
}
```

**Jest統合**:
```typescript
// test/compliance/tagging.test.ts
import { execSync } from 'child_process';
import * as fs from 'fs';

describe('Tagging Compliance', () => {
  test('All resources have required tags', () => {
    // CDK Synth
    execSync('npx cdk synth --all', { stdio: 'inherit' });

    // OPA評価
    const result = execSync(
      'opa eval --data policies/ --input cdk.out/MyStack.template.json "data.aws.tagging.violation"',
      { encoding: 'utf-8' }
    );

    const violations = JSON.parse(result);
    expect(violations.result).toHaveLength(0);
  });
});
```

## E2E Test

### Playwright（フロントエンド統合）

```typescript
// test/e2e/user-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should register new user and login', async ({ page }) => {
    const apiUrl = process.env.API_URL!;

    // 登録ページ
    await page.goto(`${apiUrl}/register`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // 確認メール送信確認
    await expect(page.locator('text=Confirmation email sent')).toBeVisible();

    // 認証トークン取得（E2Eテスト用エンドポイント）
    const token = await page.evaluate(async () => {
      const res = await fetch('/test/verify-email?email=test@example.com');
      return res.json();
    });

    // ログイン
    await page.goto(`${apiUrl}/login?token=${token}`);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
```

### Postman（API統合）

```json
{
  "info": { "name": "API E2E Tests" },
  "item": [
    {
      "name": "Create User",
      "request": {
        "method": "POST",
        "url": "{{API_URL}}/users",
        "body": {
          "mode": "raw",
          "raw": "{\"email\": \"test@example.com\"}"
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Status 201', () => pm.response.to.have.status(201));",
              "pm.test('User ID returned', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json).to.have.property('id');",
              "  pm.environment.set('userId', json.id);",
              "});"
            ]
          }
        }
      ]
    },
    {
      "name": "Get User",
      "request": {
        "method": "GET",
        "url": "{{API_URL}}/users/{{userId}}"
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('User data matches', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json.email).to.eql('test@example.com');",
              "});"
            ]
          }
        }
      ]
    }
  ]
}
```

## テスト実行スクリプト

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest test/unit",
    "test:snapshot": "jest test/snapshot",
    "test:integration": "jest test/integration --runInBand",
    "test:security": "jest test/security && cfn-nag_scan --input-path cdk.out/",
    "test:compliance": "jest test/compliance",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:snapshot && npm run test:security",
    "test:ci": "npm run test:all && npm run test:integration"
  }
}
```

## テストカバレッジ目標

| テストタイプ | カバレッジ目標 | 測定方法 |
|------------|--------------|---------|
| Unit | 80%以上 | リソース作成テスト数/総リソース数 |
| Snapshot | 100% | 全スタックでSnapshot作成 |
| Integration | Critical Path 100% | 主要エンドポイント・データフロー |
| Security | 0 violations | cfn-nag, cdk-nag |
| Compliance | 100% | 必須タグ、必須設定 |

## CI/CD統合

```yaml
# .github/workflows/cdk-test.yml
name: CDK Test Pipeline

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:snapshot

  security-test:
    needs: unit-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
      - run: gem install cfn-nag
      - run: npm ci
      - run: npx cdk synth
      - run: cfn-nag_scan --input-path cdk.out/

  integration-test:
    needs: security-test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npx cdk deploy TestStack --require-approval never
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - run: npm run test:integration
      - run: npx cdk destroy TestStack --force
        if: always()
```

## まとめ

### テスト実施タイミング

| フェーズ | テスト | 目的 |
|---------|-------|------|
| ローカル開発 | Unit, Snapshot | 迅速なフィードバック |
| Commit | Unit, Snapshot | リグレッション防止 |
| PR作成 | Security, Compliance | 品質ゲート |
| PR承認前 | Integration | 実環境動作保証 |
| デプロイ前 | E2E | エンドツーエンド検証 |

### テスト失敗時の対応

1. **Unit/Snapshot失敗**: コード修正またはスナップショット更新
2. **Security失敗**: 設計見直し（抑制は最小限）
3. **Integration失敗**: デプロイブロック、根本原因分析
4. **E2E失敗**: ロールバック、緊急パッチ
