import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Length } from 'class-validator';

export class Step2VerifyDto {
  @ApiProperty({
    description: 'ID-ul utilizatorului (trimis din pasul 1)',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty({ message: 'ID-ul utilizatorului este obligatoriu' })
  userId: number;

  @ApiProperty({
    description: 'Codul OTP de 6 cifre primit pe telefon',
    example: '123456',
    minLength: 6,
    maxLength: 6
  })
  @IsString()
  @Length(6, 6)
  otp: string;
} 