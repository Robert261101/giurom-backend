import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

// Main Employee module controllers (acting as gateway)
import { EmployeeController } from './employee.controller';
import { WorkLocationHistoryController } from './work-location-history/work-location-history.controller';
import { EmployeeFilesController } from './employee-files/employee-files.controller';
import { GeneratedDocumentsController } from './generated-documents/generated-documents.controller';

@Module({
  imports: [
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
  providers: [],
  exports: [],
})
export class EmployeeModule {} 