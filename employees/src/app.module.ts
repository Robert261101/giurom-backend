import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { EmployeeMicroController } from './employee.micro.controller';
import { EmployeeHttpController } from './employee.http.controller';
import { EmployeeService } from './employee.service';
import { Employee } from './entities/employee.entity';
import { EmployeeWorkLocationHistory } from './entities/employee-work-location-history.entity';
import { EmployeeFiles } from './entities/employee-files.entity';
import { GeneratedDocuments } from './entities/generated-documents.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [Employee, EmployeeWorkLocationHistory, EmployeeFiles, GeneratedDocuments],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
    }),
    TypeOrmModule.forFeature([
      Employee,
      EmployeeWorkLocationHistory,
      EmployeeFiles,
      GeneratedDocuments,
    ]),
  ],
  controllers: [EmployeeMicroController, EmployeeHttpController],
  providers: [EmployeeService],
})
export class AppModule {}