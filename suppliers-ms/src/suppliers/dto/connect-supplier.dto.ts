import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConnectSupplierDto {
  @ApiProperty({
    description: 'Cod unic de asociere al furnizorului cu cont',
    example: 'AB3K9M2Q7X4P',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(32)
  code!: string;
}
