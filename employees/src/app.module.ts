import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmployeeMicroController } from './employee.micro.controller';
import { EmployeeHttpController } from './employee.http.controller';
import { EmployeeService } from './employee.service';
import { Employee } from './entities/employee.entity';
import { EmployeeWorkLocationHistory } from './entities/employee-work-location-history.entity';
import { EmployeeFiles } from './entities/employee-files.entity';
import { GeneratedDocuments } from './entities/generated-documents.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [Employee, EmployeeWorkLocationHistory, EmployeeFiles, GeneratedDocuments],
      synchronize: true,
      logging: false,
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