import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsDateString, Length } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'ID-ul angajatului asociat acestui cont',
    example: 1,
  })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  id_employee: number;

  @ApiProperty({
    description: 'Parola utilizatorului (va fi hash-uită automat)',
    example: 'parola123',
    minLength: 6,
    maxLength: 255,
  })
  @IsString({ message: 'Parola trebuie să fie un string' })
  @Length(6, 255, { message: 'Parola trebuie să aibă între 6 și 255 de caractere' })
  password: string;

  @ApiProperty({
    description: 'URL-ul imaginii de profil',
    example: '/api/images/profile_1.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'URL-ul imaginii trebuie să fie un string' })
  profile_image?: string;


  @ApiProperty({
    description: 'Statusul activ al utilizatorului',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Statusul activ trebuie să fie boolean' })
  is_active?: boolean;

  @ApiProperty({
    description: 'Indică dacă autentificarea în doi factori (2FA) este activată',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Statusul 2FA trebuie să fie boolean' })
  is_2fa?: boolean;
}
