import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmployeesController } from './controllers/employees.controller';
import { EmployeeFilesController } from './controllers/employee-files.controller';
import { GeneratedDocumentsController } from './controllers/generated-documents.controller';
import { WorkLocationHistoryController } from './controllers/work-location-history.controller';
import { CompaniesController } from './controllers/companies.controller';
import { LocationsController } from './controllers/locations.controller';
import { SuppliersController } from './controllers/suppliers.controller';
import { SuppliersFilesController } from './controllers/suppliers-files.controller';
import { StockController } from './controllers/stock.controller';
import { RecipesController } from './controllers/recipes.controller';
import { RecipePreparationsController } from './controllers/recipes-preparations.controller';
import { AuthController } from './controllers/auth.controller';
import { CalendarController } from './controllers/calendar.controller';

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
      {
        name: 'COMPANY_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.COMPANY_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.COMPANY_MS_PORT || '4002', 10),
        },
      },
      {
        name: 'LOCATIONS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.LOCATIONS_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.LOCATIONS_MS_PORT || '4003', 10),
        },
      },
      {
        name: 'CALENDAR_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.CALENDAR_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.CALENDAR_MS_PORT || '4006', 10),
        },
      },
      {
        name: 'SUPPLIERS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.SUPPLIERS_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.SUPPLIERS_MS_PORT || '4008', 10),
        },
      },
      {
        name: 'STOCK_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.STOCK_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.STOCK_MS_PORT || '4004', 10),
        },
      },
      {
        name: 'RECIPES_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.RECIPES_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.RECIPES_MS_PORT || '4005', 10),
        },
      },
    ]),
  ],
  controllers: [
    EmployeesController,
    EmployeeFilesController,
    GeneratedDocumentsController,
    WorkLocationHistoryController,
    CompaniesController,
    LocationsController,
    SuppliersController,
    SuppliersFilesController,
    StockController,
    RecipesController,
    RecipePreparationsController,
    AuthController,
    CalendarController,
  ],
})
export class AppModule {} 