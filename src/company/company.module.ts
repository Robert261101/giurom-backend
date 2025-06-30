import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyDocument])],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {} 