import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class Step1LoginDto {
  @ApiProperty({
    description: 'Email-ul sau numărul de telefon al utilizatorului',
    example: 'test@example.com sau 0787448331',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email-ul sau numărul de telefon este obligatoriu' })
  @Matches(
    /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|07[0-9]{8})$/,
    { 
      message: 'Trebuie să fie un email valid sau un număr de telefon românesc (07XXXXXXXX)' 
    }
  )
  identifier: string;

  @ApiProperty({
    description: 'Parola utilizatorului',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
} 