import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Length,
} from 'class-validator';

export class CreateSupplierFolderDto {
  @ApiProperty({ description: 'ID furnizor', example: 1 })
  @IsNumber({}, { message: 'supplier_id trebuie să fie un număr' })
  @IsPositive({ message: 'supplier_id trebuie să fie pozitiv' })
  supplier_id: number;

  @ApiProperty({ description: 'Descrierea folderului', example: 'Folder pentru documente contractuale' })
  @IsString({ message: 'Descrierea trebuie să fie un string' })
  @IsNotEmpty({ message: 'Descrierea este obligatorie' })
  @Length(5, 255, { message: 'Descrierea trebuie să aibă între 5 și 255 de caractere' })
  description: string;

  @ApiProperty({ description: 'Calea folderului în cloud', example: '/suppliers/1/alimentara-srl/data/' })
  @IsString({ message: 'Calea folderului trebuie să fie un string' })
  @IsNotEmpty({ message: 'Calea folderului este obligatorie' })
  @Length(5, 500, { message: 'Calea folderului trebuie să aibă între 5 și 500 de caractere' })
  folder_path: string;
}