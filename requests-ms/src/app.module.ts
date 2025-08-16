import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { ShiftChangeRequestsModule } from './shift-change-requests/shift-change-requests.module';
import { EmployeeModule } from './employee/employee.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Ensure we load the microservice-specific .env even when started from repo root
      envFilePath: ['requests-ms/.env', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
    }),
    EmployeeModule,
    LeaveRequestsModule,
    ShiftChangeRequestsModule,
  ],
})
export class AppModule {}