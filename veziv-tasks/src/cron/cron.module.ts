import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { TaskAssignment } from '../assignment/entity/task-assignment.entity';
import { TaskExecution } from '../execution/entity/task-execution.entity';
import { TaskExecutionAnswer } from '../execution/entity/task-execution-answer.entity';
import { EmployeeDailyPoints } from '../execution/entity/employee-daily-points.entity';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,
    TypeOrmModule.forFeature([
      TaskAssignment,
      TaskExecution,
      TaskExecutionAnswer,
      EmployeeDailyPoints
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET') || 'your-secret-key';
        const expiresIn = configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '24h';
        return {
          global: true,
          secret: secret,
          signOptions: { 
            expiresIn: expiresIn
          },
        };
      },
      inject: [ConfigService],
    }),
    ExecutionModule
  ],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService]
})
export class CronModule {}
