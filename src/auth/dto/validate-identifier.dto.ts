import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ValidateIdentifierDto {
  @ApiProperty({
    description: 'Email-ul sau numărul de telefon al utilizatorului',
    example: 'user@example.com sau +40123456789'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(.+@.+\..+|\+?[0-9]{10,15})$/, {
    message: 'Trebuie să fie un email valid sau un număr de telefon valid'
  })
  identifier: string;
} 