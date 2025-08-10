import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyDocument]),
    ClientsModule.register([
      {
        name: 'COMPANY_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.COMPANY_MS_HOST || '127.0.0.1',
          port: parseInt(process.env.COMPANY_MS_PORT || '4002', 10),
        },
      },
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {} 