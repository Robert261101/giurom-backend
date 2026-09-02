import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './company/entity/company.entity';
import { CompanyDocument } from './company/entity/company-document.entity';
import { SubscriptionPlan } from './company/entity/subscription-plan.entity';
import { PlanLimit } from './company/entity/plan-limit.entity';
import { CompanySubscription } from './company/entity/company-subscription.entity';
import { SubscriptionInvoice } from './company/entity/subscription-invoice.entity';
import { CompanyService } from './company/company.service';
import { SubscriptionService } from './company/subscription.service';
import { CompanyMicroController } from './company.micro.controller';
import { CompanyHttpController } from './company.http.controller';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { InternalServiceGuard } from './auth/internal-service.guard';

@Module({
  imports: [
    AuthModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_RMQ',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
          queueOptions: { durable: false },
        },
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [
        Company,
        CompanyDocument,
        SubscriptionPlan,
        PlanLimit,
        CompanySubscription,
        SubscriptionInvoice,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        initStatements: [
          "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
          'SET CHARACTER SET utf8mb4',
          'SET character_set_connection=utf8mb4',
        ],
      },
    }),
    TypeOrmModule.forFeature([
      Company,
      CompanyDocument,
      SubscriptionPlan,
      PlanLimit,
      CompanySubscription,
      SubscriptionInvoice,
    ]),
  ],
  controllers: [CompanyMicroController, CompanyHttpController],
  providers: [
    CompanyService,
    SubscriptionService,
    InternalServiceGuard,
    { provide: APP_GUARD, useClass: InternalServiceGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}