import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';

// Main Employee entities
import { Employee } from './entity/employee.entity';
import { EmployeeWorkLocationHistory } from './entity/employee-work-location-history.entity';
import { EmployeeFiles } from './entity/employee-files.entity';
import { GeneratedDocuments } from './entity/generated-documents.entity';

// Main Employee module
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';

// Work Location History submodule
import { WorkLocationHistoryService } from './work-location-history/work-location-history.service';
import { WorkLocationHistoryController } from './work-location-history/work-location-history.controller';

// Employee Files submodule
import { EmployeeFilesService } from './employee-files/employee-files.service';
import { EmployeeFilesController } from './employee-files/employee-files.controller';

// Generated Documents submodule
import { GeneratedDocumentsService } from './generated-documents/generated-documents.service';
import { GeneratedDocumentsController } from './generated-documents/generated-documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeWorkLocationHistory,
      EmployeeFiles,
      GeneratedDocuments,
    ]),
    ClientsModule.register([
      {
        name: 'EMPLOYEES_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.EMPLOYEES_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.EMPLOYEES_MS_PORT || '4001', 10),
        },
      },
    ]),
  ],
  controllers: [
    EmployeeController,
    WorkLocationHistoryController,
    EmployeeFilesController,
    GeneratedDocumentsController,
  ],
  providers: [
    EmployeeService,
    WorkLocationHistoryService,
    EmployeeFilesService,
    GeneratedDocumentsService,
  ],
  exports: [
    EmployeeService,
    WorkLocationHistoryService,
    EmployeeFilesService,
    GeneratedDocumentsService,
  ],
})
export class EmployeeModule {} 