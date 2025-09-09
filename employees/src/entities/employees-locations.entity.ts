import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Employee } from './employee.entity';

// Local WorkLocation reference entity for cross-microservice relationships
@Entity('work_locations')
export class WorkLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  location_name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('employees_locations')
export class EmployeesLocations {
  @ApiProperty({
    description: 'ID-ul unic al asocierii angajat-locație',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'ID-ul angajatului',
    example: 1,
  })
  @Column()
  employee_id: number;

  @ApiProperty({
    description: 'ID-ul locației de lucru',
    example: 1,
  })
  @Column()
  id_location: number;

  @ApiProperty({
    description: 'Data creării asocierii',
    example: '2023-12-01T10:00:00Z',
  })
  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @ApiProperty({
    description: 'Data ultimei actualizări',
    example: '2023-12-01T10:00:00Z',
  })
  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  // Relationships
  @ManyToOne(() => Employee, (employee) => employee.employeeLocations, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @ManyToOne(() => WorkLocation, { nullable: false })
  @JoinColumn({ name: 'id_location' })
  workLocation?: WorkLocation;
}