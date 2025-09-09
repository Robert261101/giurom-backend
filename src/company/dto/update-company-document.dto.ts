import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCompanyDocumentDto } from './create-company-document.dto';

export class UpdateCompanyDocumentDto extends PartialType(
  OmitType(CreateCompanyDocumentDto, ['company_id'] as const),
) {} 