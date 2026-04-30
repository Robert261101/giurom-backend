import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { join } from 'path';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmployeeMicroController } from './employee.micro.controller';
import { EmployeeHttpController } from './employee.http.controller';
import { EmployeeService } from './employee.service';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { Employee } from './entities/employee.entity';
import { EmployeeWorkLocationHistory } from './entities/employee-work-location-history.entity';
import { EmployeeFiles } from './entities/employee-files.entity';
import { GeneratedDocuments } from './entities/generated-documents.entity';
import { EmployeeLocation } from './entities/employee-location.entity';
import { EmployeeFolder } from './entities/employee-folder.entity';
import { InternalServiceGuard } from './auth/internal-service.guard';

@Module({
  imports: [
    AuthModule,
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
    HttpModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      connectorPackage: 'mysql2',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [Employee, EmployeeWorkLocationHistory, EmployeeFiles, GeneratedDocuments, EmployeeLocation, EmployeeFolder],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature([
      Employee,
      EmployeeWorkLocationHistory,
      EmployeeFiles,
      GeneratedDocuments,
      EmployeeLocation,
      EmployeeFolder,
    ]),
  ],
  controllers: [EmployeeMicroController, EmployeeHttpController],
  providers: [
    EmployeeService,
    InternalServiceGuard,
    { provide: APP_GUARD, useClass: InternalServiceGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
