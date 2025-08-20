import { PartialType } from '@nestjs/swagger';
import { CreateGeneratedDocumentDto } from './create-generated-document.dto';
 
export class UpdateGeneratedDocumentDto extends PartialType(CreateGeneratedDocumentDto) {}