# AWS CDK ベストプラクティス

AWS CDK（TypeScript）を使用したインフラコード実装のベストプラクティス。保守性、テスタビリティ、スケーラビリティを確保する。

## 関連ドキュメント

このドキュメントはAWSインフラの**CDK実装フェーズ**で使用します。

**関連ステアリングファイル**:
- **infrastructure-requirements.md**: 実装すべきAWS Well-Architected要件の定義
- **infrastructure-testing.md**: 実装したCDKコードのテスト方法

**実装前の必須確認**:
1. **infrastructure-requirements.md** の必須チェック項目を確認
2. **Infrastructure Design Doc** の設計に従って実装
3. **本ファイルのベストプラクティス**に準拠したCDKコード作成
4. **infrastructure-testing.md** に従ってテスト作成

**チェックリスト連携**:
- infrastructure-requirements.md の必須項目 → 本ファイルの実装チェックリストで実装 → infrastructure-testing.md のテストケースで検証

**エージェント使用**:
- CDK実装: **cdk-implementer** エージェント（本ファイル参照）
- テスト・検証: **infrastructure-validator** エージェント（infrastructure-testing.md参照）

## CDK基本原則

### 1. プロジェクト構成

**推奨ディレクトリ構造**:
```
infrastructure/
├── bin/
│   └── app.ts                    # CDKアプリケーションエントリーポイント
├── lib/
│   ├── stacks/                   # スタック定義
│   │   ├── network-stack.ts      # VPC, Subnet, Security Group
│   │   ├── compute-stack.ts      # ECS, Lambda
│   │   ├── database-stack.ts     # RDS, DynamoDB
│   │   └── monitoring-stack.ts   # CloudWatch, Alarms
│   ├── constructs/               # 再利用可能なコンストラクト
│   │   ├── secure-bucket.ts
│   │   ├── api-lambda.ts
│   │   └── monitored-service.ts
│   └── config/                   # 環境別設定
│       ├── types.ts
│       ├── dev.ts
│       ├── staging.ts
│       └── production.ts
├── test/                         # テスト
│   ├── unit/
│   ├── integration/
│   └── snapshot/
├── cdk.json                      # CDK設定
└── cdk.context.json              # コンテキスト（自動生成）
```

### 2. スタック設計原則

**単一責任の原則**:
```typescript
// 良い例: 責務ごとにスタック分離
export class NetworkStack extends Stack {
  public readonly vpc: ec2.IVpc;
  // VPC, Subnet, Security Groupのみ
}

export class ComputeStack extends Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);
    // props.vpcを参照してECS/Lambdaを構築
  }
}

// 悪い例: 全てを1つのスタックに
export class MonolithStack extends Stack {
  // VPC, ECS, RDS, Lambda全て...（管理困難）
}
```

**スタック間の依存関係管理**:
```typescript
// bin/app.ts
const app = new App();

const networkStack = new NetworkStack(app, 'NetworkStack', { env });
const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
  env,
  vpc: networkStack.vpc, // 明示的な依存関係
});
const computeStack = new ComputeStack(app, 'ComputeStack', {
  env,
  vpc: networkStack.vpc,
  database: databaseStack.database,
});

// CloudFormationで自動的に依存順序が解決される
```

### 3. 環境分離戦略

**環境別設定の外部化**:
```typescript
// lib/config/types.ts
export interface EnvironmentConfig {
  readonly env: { account: string; region: string };
  readonly vpcCidr: string;
  readonly instanceType: ec2.InstanceType;
  readonly minCapacity: number;
  readonly maxCapacity: number;
  readonly enableBackup: boolean;
  readonly logRetention: logs.RetentionDays;
}

// lib/config/production.ts
export const productionConfig: EnvironmentConfig = {
  env: { account: '123456789012', region: 'ap-northeast-1' },
  vpcCidr: '10.0.0.0/16',
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
  minCapacity: 2,
  maxCapacity: 10,
  enableBackup: true,
  logRetention: logs.RetentionDays.ONE_YEAR,
};

// lib/config/development.ts
export const developmentConfig: EnvironmentConfig = {
  env: { account: '987654321098', region: 'ap-northeast-1' },
  vpcCidr: '10.2.0.0/16',
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
  minCapacity: 1,
  maxCapacity: 2,
  enableBackup: false,
  logRetention: logs.RetentionDays.ONE_WEEK,
};

// bin/app.ts
const environment = process.env.ENVIRONMENT || 'development';
const config = environment === 'production' ? productionConfig : developmentConfig;

new NetworkStack(app, `${environment}-NetworkStack`, { env: config.env });
```

**CDK Contextの活用**:
```json
// cdk.json
{
  "context": {
    "@aws-cdk/core:enableStackNameDuplicates": false,
    "@aws-cdk/core:stackRelativeExports": true,
    "availability-zones:account=123456789012:region=ap-northeast-1": [
      "ap-northeast-1a",
      "ap-northeast-1c",
      "ap-northeast-1d"
    ]
  }
}
```

## コンストラクト設計

### L1（CFN Raw Resources）→ L3（Patterns）への移行

**推奨: L3 Constructsの活用**:
```typescript
// 良い例: L3 Construct（高レベル抽象化）
import * as patterns from 'aws-cdk-lib/aws-ecs-patterns';

new patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
  vpc,
  taskImageOptions: {
    image: ecs.ContainerImage.fromRegistry('myapp:latest'),
  },
  desiredCount: 2,
  // ALB, Target Group, ECS Service, Task Definitionが自動生成
});

// 悪い例: L1 Construct（低レベル、冗長）
import * as cfn from 'aws-cdk-lib/aws-ecs';

const taskDef = new cfn.CfnTaskDefinition(this, 'TaskDef', { /* 膨大な設定 */ });
const service = new cfn.CfnService(this, 'Service', { /* 膨大な設定 */ });
const alb = new cfn.CfnLoadBalancer(this, 'ALB', { /* 膨大な設定 */ });
// ... 数百行の設定が必要
```

### カスタムConstructの作成

**再利用可能なコンポーネント化**:
```typescript
// lib/constructs/monitored-lambda.ts
export interface MonitoredLambdaProps {
  readonly functionName: string;
  readonly handler: string;
  readonly code: lambda.Code;
  readonly environment?: { [key: string]: string };
  readonly alarmEmail: string;
}

export class MonitoredLambda extends Construct {
  public readonly function: lambda.Function;
  public readonly errorAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: MonitoredLambdaProps) {
    super(scope, id);

    // Lambda関数
    this.function = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: props.handler,
      code: props.code,
      environment: props.environment,
      timeout: Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE, // X-Ray有効化
    });

    // エラーメトリクス
    const errorMetric = this.function.metricErrors({
      statistic: 'Sum',
      period: Duration.minutes(5),
    });

    // アラーム
    this.errorAlarm = new cloudwatch.Alarm(this, 'ErrorAlarm', {
      metric: errorMetric,
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: `${props.functionName} エラー率が高い`,
    });

    // SNS通知
    const topic = new sns.Topic(this, 'AlarmTopic');
    topic.addSubscription(new subscriptions.EmailSubscription(props.alarmEmail));
    this.errorAlarm.addAlarmAction(new actions.SnsAction(topic));

    // ログ保持期間
    new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${this.function.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}

// 使用例
new MonitoredLambda(this, 'MyLambda', {
  functionName: 'my-api-handler',
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda'),
  alarmEmail: 'ops-team@example.com',
});
```

## セキュリティベストプラクティス

### IAMポリシーの最小権限化

```typescript
// 良い例: 明示的なリソースARN、必要最小限のアクション
const bucket = new s3.Bucket(this, 'DataBucket');
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

bucket.grantRead(lambdaRole); // s3:GetObject, s3:ListBucket のみ付与

// 悪い例: ワイルドカード、過剰な権限
lambdaRole.addToPolicy(new iam.PolicyStatement({
  actions: ['s3:*'],
  resources: ['*'],
}));
```

### Secrets Managerの活用

```typescript
// 良い例: Secrets Managerで認証情報管理
const dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'admin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
  },
});

const rds = new rds.DatabaseInstance(this, 'Database', {
  engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
  credentials: rds.Credentials.fromSecret(dbSecret),
  // ...
});

// Lambda環境変数でSecrets ARNを渡す
const lambda = new lambda.Function(this, 'Function', {
  environment: {
    DB_SECRET_ARN: dbSecret.secretArn, // ARNのみ（値は渡さない）
  },
});
dbSecret.grantRead(lambda); // 実行時にSDKで取得

// 悪い例: 平文で環境変数に設定
const lambda = new lambda.Function(this, 'Function', {
  environment: {
    DB_PASSWORD: 'hardcoded-password', // 絶対禁止
  },
});
```

### データ暗号化の徹底

```typescript
// S3バケット暗号化
const bucket = new s3.Bucket(this, 'SecureBucket', {
  encryption: s3.BucketEncryption.KMS, // KMS推奨（監査可能）
  encryptionKey: kmsKey, // カスタムKMSキー
  enforceSSL: true, // HTTPS必須
  versioned: true, // バージョニング有効
});

// RDS暗号化
const db = new rds.DatabaseInstance(this, 'Database', {
  storageEncrypted: true, // 必須
  storageEncryptionKey: kmsKey, // カスタムKMSキー
});

// DynamoDB暗号化
const table = new dynamodb.Table(this, 'Table', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED, // KMS推奨
  encryptionKey: kmsKey,
});
```

## パフォーマンス最適化

### Lambda最適化

```typescript
// メモリ最適化: AWS Lambda Power Tuningで測定
const lambda = new lambda.Function(this, 'OptimizedLambda', {
  memorySize: 1769, // コスト効率が最良のポイント（測定結果）
  timeout: Duration.seconds(10),
  reservedConcurrentExecutions: 10, // スロットリング防止
  environment: {
    NODE_OPTIONS: '--enable-source-maps', // デバッグ効率化
  },
});

// Lambda Layer活用（共通ライブラリ）
const layer = new lambda.LayerVersion(this, 'CommonLayer', {
  code: lambda.Code.fromAsset('layers/common'),
  compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
});

const func = new lambda.Function(this, 'Function', {
  layers: [layer],
  // デプロイパッケージサイズ削減 → コールドスタート高速化
});
```

### Graviton（Arm64）最適化【Sustainability対応】

```typescript
// Lambda Graviton採用（省エネ・高パフォーマンス）
const gravitonLambda = new lambda.Function(this, 'GravitonLambda', {
  runtime: lambda.Runtime.NODEJS_20_X,
  architecture: lambda.Architecture.ARM_64, // x86比40%省エネ、34%高速
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda'),
  memorySize: 512,
});

// ECS Fargate Graviton採用
const taskDefinition = new ecs.FargateTaskDefinition(this, 'GravitonTask', {
  cpu: 256,
  memoryLimitMiB: 512,
  runtimePlatform: {
    cpuArchitecture: ecs.CpuArchitecture.ARM64, // 40%の価格性能比向上
    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
  },
});

taskDefinition.addContainer('App', {
  image: ecs.ContainerImage.fromRegistry('arm64v8/node:20-alpine'),
  // Arm64対応のコンテナイメージを使用
});

// RDS Graviton採用（PostgreSQL/MySQL/MariaDB）
const database = new rds.DatabaseInstance(this, 'GravitonRDS', {
  engine: rds.DatabaseInstanceEngine.postgres({
    version: rds.PostgresEngineVersion.VER_15,
  }),
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.R7G, // Graviton3世代
    ec2.InstanceSize.LARGE,
  ),
  vpc,
  // 最大35%の価格性能比向上
});

// EC2 Graviton採用
const instance = new ec2.Instance(this, 'GravitonInstance', {
  instanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T4G, // Graviton2世代
    ec2.InstanceSize.MEDIUM,
  ),
  machineImage: new ec2.AmazonLinuxImage({
    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
    cpuType: ec2.AmazonLinuxCpuType.ARM_64,
  }),
  vpc,
});

// 互換性チェック
// ✅ 推奨: Node.js, Python, Java, .NET Core, Ruby, Go, Rust
// ❌ 非推奨: x86固有バイナリ、レガシーネイティブライブラリ依存
```

### VPC Lambda最適化

```typescript
// 悪い例: NAT Gatewayコスト高、レイテンシ増
const lambda = new lambda.Function(this, 'VpcLambda', {
  vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }, // NAT必要
});

// 良い例: VPC Endpointsで外部通信不要
const s3Endpoint = vpc.addGatewayEndpoint('S3Endpoint', {
  service: ec2.GatewayVpcEndpointAwsService.S3,
});

const dynamoEndpoint = vpc.addGatewayEndpoint('DynamoEndpoint', {
  service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
});

// Lambda → S3/DynamoDBがインターネット不要
```

### CloudFront + S3最適化

```typescript
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

const bucket = new s3.Bucket(this, 'StaticAssets', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // 直接アクセス禁止
});

const distribution = new cloudfront.Distribution(this, 'CDN', {
  defaultBehavior: {
    origin: new origins.S3Origin(bucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    compress: true, // Gzip圧縮
  },
  priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // アジア・欧米のみ
});
```

## テスト戦略

### Unit Test（スタック生成検証）

```typescript
// test/unit/network-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../../lib/stacks/network-stack';

test('VPC has 2 Availability Zones', () => {
  const app = new App();
  const stack = new NetworkStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  // VPCが2AZに配置されているか
  template.resourceCountIs('AWS::EC2::Subnet', 6); // Public x2, Private x2, Data x2
});

test('Security Group allows only necessary ports', () => {
  const app = new App();
  const stack = new NetworkStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    SecurityGroupIngress: [
      { IpProtocol: 'tcp', FromPort: 443, ToPort: 443 },
    ],
  });
});
```

### Snapshot Test（構成変更検出）

```typescript
// test/snapshot/stacks.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../../lib/stacks/network-stack';

test('NetworkStack snapshot', () => {
  const app = new App();
  const stack = new NetworkStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  expect(template.toJSON()).toMatchSnapshot();
  // 初回実行でスナップショット作成、以降は差分検出
});
```

### Integration Test（実環境デプロイ検証）

```typescript
// test/integration/api.test.ts
import * as AWS from 'aws-sdk';

test('API returns 200', async () => {
  const apiUrl = process.env.API_URL; // CDK出力から取得
  const response = await fetch(apiUrl);
  expect(response.status).toBe(200);
});

test('DynamoDB table exists', async () => {
  const dynamodb = new AWS.DynamoDB();
  const result = await dynamodb.describeTable({
    TableName: process.env.TABLE_NAME!,
  }).promise();
  expect(result.Table?.TableStatus).toBe('ACTIVE');
});
```

## デプロイ戦略

### 段階的デプロイ

```bash
# 1. Synthで差分確認
npx cdk synth

# 2. Diffで変更内容確認
npx cdk diff NetworkStack

# 3. 破壊的変更の確認
# - Replacement: true → リソース再作成（ダウンタイム発生）
# - UpdateReplacePolicy → データ損失リスク

# 4. ChangeSetでCloudFormation変更確認
npx cdk deploy --no-execute NetworkStack
# AWS ConsoleでChangeSetsを目視確認

# 5. 本番デプロイ（承認必須）
npx cdk deploy NetworkStack --require-approval always

# 6. ロールバック（必要時）
aws cloudformation cancel-update-stack --stack-name NetworkStack
```

### Blue/Green Deployment（ECS）

```typescript
new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
  vpc,
  taskImageOptions: { image },
  deploymentController: {
    type: ecs.DeploymentControllerType.CODE_DEPLOY, // CodeDeploy統合
  },
});

// CodeDeploy Blue/Green設定
const deploymentGroup = new codedeploy.EcsDeploymentGroup(this, 'BlueGreenDG', {
  service: ecsService,
  blueGreenDeploymentConfig: {
    blueTargetGroup: blueTargetGroup,
    greenTargetGroup: greenTargetGroup,
    listener: listener,
    testListener: testListener, // テストトラフィック用
  },
  deploymentConfig: codedeploy.EcsDeploymentConfig.CANARY_10PERCENT_5MINUTES,
  autoRollback: { failedDeployment: true }, // 自動ロールバック
});
```

## コスト最適化Tips

### 不要リソースの自動削除

```typescript
// 開発環境: リソース削除を許可
const bucket = new s3.Bucket(this, 'DevBucket', {
  removalPolicy: RemovalPolicy.DESTROY, // cdk destroyで削除
  autoDeleteObjects: true, // バケット内オブジェクトも削除
});

// 本番環境: 削除保護
const bucket = new s3.Bucket(this, 'ProdBucket', {
  removalPolicy: RemovalPolicy.RETAIN, // cdk destroyでも保持
});
```

### 開発環境の自動停止

```typescript
// EventBridgeで夜間停止（平日19時〜翌9時）
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

const stopRule = new events.Rule(this, 'StopDevEnvironment', {
  schedule: events.Schedule.cron({ hour: '10', minute: '0' }), // JST 19:00 = UTC 10:00
});
stopRule.addTarget(new targets.LambdaFunction(stopFunction));

const startRule = new events.Rule(this, 'StartDevEnvironment', {
  schedule: events.Schedule.cron({ hour: '0', minute: '0' }), // JST 9:00 = UTC 0:00
});
startRule.addTarget(new targets.LambdaFunction(startFunction));
```

## CDK実装チェックリスト

### コード品質
- [ ] TypeScript strict mode有効
- [ ] 型定義明示（any禁止）
- [ ] カスタムConstructで再利用性確保
- [ ] プロパティはreadonlyで不変性保証
- [ ] 環境別設定の外部化

### セキュリティ
- [ ] IAM最小権限
- [ ] Secrets Manager使用（平文禁止）
- [ ] S3/RDS/DynamoDB暗号化
- [ ] VPCプライベートサブネット配置
- [ ] Security Group最小化

### 信頼性
- [ ] マルチAZ配置
- [ ] Auto Scaling設定
- [ ] ヘルスチェック設定
- [ ] DLQ設定（Lambda, SQS）
- [ ] バックアップ戦略

### 運用監視
- [ ] CloudWatch Logs保持期間設定
- [ ] CloudWatch Alarms設定
- [ ] X-Ray Tracing有効化
- [ ] タグ戦略（環境、コスト配分）

### コスト
- [ ] 不要リソースのRemovalPolicy設定
- [ ] 開発環境の自動停止設定
- [ ] Reserved Instances検討（稼働率 > 70%）
- [ ] S3ライフサイクルポリシー

### テスト
- [ ] Unit test作成（assertions）
- [ ] Snapshot test作成
- [ ] Integration test作成（CI/CD）

### デプロイ
- [ ] cdk diffで変更確認
- [ ] 破壊的変更の事前確認
- [ ] ロールバック手順の文書化
