import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { ShiftChangeRequestsModule } from './shift-change-requests/shift-change-requests.module';
import { EmployeeModule } from './employee/employee.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { InternalServiceGuard } from './auth/internal-service.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { RequestsCronService } from './requests-cron.service';
import { PlanAccessModule } from './plan-access/plan-access.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    ScheduleModule.forRoot(),
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
      type: 'mysql',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
    }),
    PlanAccessModule,
    EmployeeModule,
    LeaveRequestsModule,
    ShiftChangeRequestsModule,
  ],
  providers: [
    InternalServiceGuard,
    {
      provide: APP_GUARD,
      useClass: InternalServiceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    JwtStrategy,
    RequestsCronService,
  ],
})
export class AppModule {}