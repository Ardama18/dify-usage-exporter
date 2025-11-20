# Backend アーキテクチャ (NestJS)

このドキュメントは、NestJS を使用したバックエンドアプリケーションのアーキテクチャを定義します。

## 技術スタック

- **フレームワーク**: NestJS
- **言語**: TypeScript (strict mode)
- **ORM**: Prisma
- **データベース**: PostgreSQL
- **テスト**: Vitest
- **バリデーション**: class-validator, class-transformer

## ディレクトリ構造

```
backend/
├── src/
│   ├── main.ts                 # アプリケーションエントリーポイント
│   ├── app.module.ts           # ルートモジュール
│   ├── app.controller.ts       # ルートコントローラー
│   ├── app.service.ts          # ルートサービス
│   │
│   ├── modules/                # 機能モジュール
│   │   ├── debtors/           # 債務者モジュール
│   │   │   ├── debtors.module.ts
│   │   │   ├── debtors.controller.ts
│   │   │   ├── debtors.service.ts
│   │   │   ├── dto/           # Data Transfer Objects
│   │   │   │   ├── create-debtor.dto.ts
│   │   │   │   └── update-debtor.dto.ts
│   │   │   └── entities/      # エンティティ (Prismaスキーマから生成)
│   │   │       └── debtor.entity.ts
│   │   │
│   │   ├── scenarios/         # シナリオモジュール
│   │   │   ├── scenarios.module.ts
│   │   │   ├── scenarios.controller.ts
│   │   │   └── scenarios.service.ts
│   │   │
│   │   └── reminders/         # 督促履歴モジュール
│   │       ├── reminders.module.ts
│   │       ├── reminders.controller.ts
│   │       └── reminders.service.ts
│   │
│   ├── common/                # 共通機能
│   │   ├── filters/          # 例外フィルター
│   │   ├── guards/           # ガード (認証・認可)
│   │   ├── interceptors/     # インターセプター
│   │   ├── pipes/            # パイプ (バリデーション)
│   │   └── decorators/       # カスタムデコレーター
│   │
│   ├── config/               # 設定
│   │   └── database.config.ts
│   │
│   └── prisma/               # Prisma設定
│       ├── prisma.service.ts
│       └── schema.prisma
│
├── test/                     # テストファイル
│   ├── unit/                # 単体テスト
│   └── integration/         # 統合テスト
│
├── prisma/                  # Prismaスキーマ・マイグレーション
│   ├── schema.prisma
│   └── migrations/
│
└── package.json
```

## NestJS モジュールベースアーキテクチャ

### 1. モジュール構成

#### ルートモジュール
```typescript
// src/app.module.ts
import { Module } from '@nestjs/common'
import { DebtorsModule } from './modules/debtors/debtors.module'
import { ScenariosModule } from './modules/scenarios/scenarios.module'
import { RemindersModule } from './modules/reminders/reminders.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    PrismaModule,
    DebtorsModule,
    ScenariosModule,
    RemindersModule,
  ],
})
export class AppModule {}
```

#### 機能モジュール
```typescript
// src/modules/debtors/debtors.module.ts
import { Module } from '@nestjs/common'
import { DebtorsController } from './debtors.controller'
import { DebtorsService } from './debtors.service'
import { PrismaModule } from '@/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [DebtorsController],
  providers: [DebtorsService],
  exports: [DebtorsService], // 他モジュールで使用する場合
})
export class DebtorsModule {}
```

### 2. Controller (コントローラー)

#### REST API エンドポイント定義
```typescript
// src/modules/debtors/debtors.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { DebtorsService } from './debtors.service'
import { CreateDebtorDto } from './dto/create-debtor.dto'
import { UpdateDebtorDto } from './dto/update-debtor.dto'

@Controller('debtors')
export class DebtorsController {
  constructor(private readonly debtorsService: DebtorsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDebtorDto: CreateDebtorDto) {
    return this.debtorsService.create(createDebtorDto)
  }

  @Get()
  findAll() {
    return this.debtorsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debtorsService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDebtorDto: UpdateDebtorDto) {
    return this.debtorsService.update(id, updateDebtorDto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.debtorsService.remove(id)
  }
}
```

### 3. Service (サービス)

#### ビジネスロジックの実装
```typescript
// src/modules/debtors/debtors.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { CreateDebtorDto } from './dto/create-debtor.dto'
import { UpdateDebtorDto } from './dto/update-debtor.dto'

@Injectable()
export class DebtorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDebtorDto: CreateDebtorDto) {
    return this.prisma.debtor.create({
      data: createDebtorDto,
    })
  }

  async findAll() {
    return this.prisma.debtor.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const debtor = await this.prisma.debtor.findUnique({
      where: { id },
    })

    if (!debtor) {
      throw new NotFoundException(`Debtor with ID ${id} not found`)
    }

    return debtor
  }

  async update(id: string, updateDebtorDto: UpdateDebtorDto) {
    await this.findOne(id) // 存在確認

    return this.prisma.debtor.update({
      where: { id },
      data: updateDebtorDto,
    })
  }

  async remove(id: string) {
    await this.findOne(id) // 存在確認

    return this.prisma.debtor.delete({
      where: { id },
    })
  }
}
```

### 4. DTO (Data Transfer Objects)

#### バリデーション付きDTO
```typescript
// src/modules/debtors/dto/create-debtor.dto.ts
import { IsString, IsEmail, IsNumber, Min } from 'class-validator'

export class CreateDebtorDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsString()
  phone: string

  @IsNumber()
  @Min(0)
  debtAmount: number

  @IsString()
  status: string
}
```

```typescript
// src/modules/debtors/dto/update-debtor.dto.ts
import { PartialType } from '@nestjs/mapped-types'
import { CreateDebtorDto } from './create-debtor.dto'

export class UpdateDebtorDto extends PartialType(CreateDebtorDto) {}
```

## Prisma 統合

### 1. Prisma Service
```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

### 2. Prisma Module
```typescript
// src/prisma/prisma.module.ts
import { Module, Global } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 3. Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Debtor {
  id         String   @id @default(uuid())
  name       String
  email      String   @unique
  phone      String
  debtAmount Float
  status     String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  reminders Reminder[]

  @@map("debtors")
}

model Scenario {
  id          String   @id @default(uuid())
  name        String
  description String?
  steps       Json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("scenarios")
}

model Reminder {
  id        String   @id @default(uuid())
  debtorId  String
  message   String
  sentAt    DateTime @default(now())
  status    String

  debtor Debtor @relation(fields: [debtorId], references: [id])

  @@map("reminders")
}
```

## 依存性注入 (DI)

### 1. サービス間の依存
```typescript
// src/modules/reminders/reminders.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { DebtorsService } from '@/modules/debtors/debtors.service'

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debtorsService: DebtorsService, // 他サービスの注入
  ) {}

  async createReminder(debtorId: string, message: string) {
    // 債務者の存在確認
    await this.debtorsService.findOne(debtorId)

    return this.prisma.reminder.create({
      data: {
        debtorId,
        message,
        status: 'sent',
      },
    })
  }
}
```

### 2. モジュール間の依存
```typescript
// src/modules/reminders/reminders.module.ts
import { Module } from '@nestjs/common'
import { RemindersController } from './reminders.controller'
import { RemindersService } from './reminders.service'
import { DebtorsModule } from '@/modules/debtors/debtors.module'

@Module({
  imports: [DebtorsModule], // 他モジュールのインポート
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
```

## エラーハンドリング

### 1. 標準的な例外
```typescript
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'

// 404 Not Found
throw new NotFoundException(`Resource not found`)

// 400 Bad Request
throw new BadRequestException('Invalid input')

// 409 Conflict
throw new ConflictException('Resource already exists')
```

### 2. カスタム例外フィルター
```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common'
import { Response } from 'express'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const status = exception.getStatus()

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: exception.message,
    })
  }
}
```

## バリデーション

### 1. グローバルバリデーションパイプ
```typescript
// src/main.ts
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // グローバルバリデーションパイプ
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTOにないプロパティを自動削除
      forbidNonWhitelisted: true, // DTOにないプロパティがあればエラー
      transform: true, // 型変換を自動実行
    }),
  )

  await app.listen(3000)
}
bootstrap()
```

### 2. カスタムバリデーター
```typescript
// src/common/validators/is-valid-status.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ async: false })
export class IsValidStatusConstraint implements ValidatorConstraintInterface {
  validate(status: string) {
    return ['pending', 'sent', 'failed'].includes(status)
  }

  defaultMessage() {
    return 'Status must be one of: pending, sent, failed'
  }
}

export function IsValidStatus(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidStatusConstraint,
    })
  }
}
```

## テスト戦略

### 1. 単体テスト (Service)
```typescript
// src/modules/debtors/debtors.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { DebtorsService } from './debtors.service'
import { PrismaService } from '@/prisma/prisma.service'

describe('DebtorsService', () => {
  let service: DebtorsService
  let prisma: PrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtorsService,
        {
          provide: PrismaService,
          useValue: {
            debtor: {
              create: vi.fn(),
              findMany: vi.fn(),
              findUnique: vi.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<DebtorsService>(DebtorsService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should create a debtor', async () => {
    const createDto = {
      name: 'Test',
      email: 'test@example.com',
      phone: '123',
      debtAmount: 1000,
      status: 'active',
    }

    vi.spyOn(prisma.debtor, 'create').mockResolvedValue({
      id: '1',
      ...createDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await service.create(createDto)
    expect(result.name).toBe('Test')
  })
})
```

### 2. 統合テスト (E2E)
```typescript
// test/debtors.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('DebtorsController (e2e)', () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('/debtors (POST)', () => {
    return request(app.getHttpServer())
      .post('/debtors')
      .send({
        name: 'Test',
        email: 'test@example.com',
        phone: '123',
        debtAmount: 1000,
        status: 'active',
      })
      .expect(201)
  })

  afterAll(async () => {
    await app.close()
  })
})
```

## セキュリティ

### 1. CORS設定
```typescript
// src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
})
```

### 2. ヘルメット (セキュリティヘッダー)
```typescript
import helmet from 'helmet'

app.use(helmet())
```

### 3. レート制限
```typescript
import { ThrottlerModule } from '@nestjs/throttler'

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
  ],
})
```

## パフォーマンス最適化

### 1. データベースクエリ最適化
```typescript
// Prismaでの最適化
async findAllWithRelations() {
  return this.prisma.debtor.findMany({
    include: {
      reminders: {
        take: 10, // 最新10件のみ
        orderBy: { sentAt: 'desc' },
      },
    },
  })
}
```

### 2. キャッシング (Redis)
```typescript
import { CacheModule } from '@nestjs/cache-manager'

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5分
      max: 100, // 最大100アイテム
    }),
  ],
})
```

## まとめ

NestJS ベストプラクティス:
1. モジュールベースアーキテクチャで機能を分離
2. Controller/Service/Repository の責務を明確に分離
3. Prisma ORM でタイプセーフなデータベース操作
4. DTOとclass-validatorでバリデーション
5. 依存性注入 (DI) の活用
6. グローバルフィルター・パイプ・ガードで横断的関心事を処理
7. 単体テスト・統合テストで品質保証
