import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class AssignEmployeeToLocationDto {
  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @IsNotEmpty({ message: 'ID-ul angajatului este obligatoriu' })
  @IsNumber({}, { message: 'ID-ul angajatului trebuie să fie un număr' })
  @IsPositive({ message: 'ID-ul angajatului trebuie să fie pozitiv' })
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @IsNotEmpty({ message: 'ID-ul locației este obligatoriu' })
  @IsNumber({}, { message: 'ID-ul locației trebuie să fie un număr' })
  @IsPositive({ message: 'ID-ul locației trebuie să fie pozitiv' })
  id_location: number;
}