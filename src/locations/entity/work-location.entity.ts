import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
import { ApiProperty } from '@nestjs/swagger';
import { Company } from '../../company/entity/company.entity';
import { WorkLocationTaskTemplate } from './work-location-task-template.entity';
import { WorkLocationDepartments } from './work-location-departments.entity';
import { Company } from "../../company/entity/company.entity";
import { WorkLocationTaskTemplate } from "./work-location-task-template.entity";
import { WorkLocationDepartments } from "./work-location-departments.entity";

@Entity("work_location")
export class WorkLocation {
  @ApiProperty({
    description: "ID-ul unic al punctului de lucru",
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: "ID-ul companiei",
    example: 1,
  })
  @Column()
  company_id: number;

  @ApiProperty({
    description: "Numele punctului de lucru",
    example: "Sediul Principal",
    maxLength: 255,
  })
  @Column({
    type: "varchar",
    length: 255,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  location_name: string;

  @ApiProperty({
    description: "Adresa punctului de lucru",
    example: "Str. Exemplu nr. 456",
  })
  @Column({
    type: "varchar",
    length: 500,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  address: string;

  @ApiProperty({
    description: "Orașul punctului de lucru",
    example: "București",
    maxLength: 100,
  })
  @Column({
    type: "varchar",
    length: 100,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  city: string;

  @ApiProperty({
    description: "Județul punctului de lucru",
    example: "București",
    maxLength: 100,
  })
  @Column({
    type: "varchar",
    length: 100,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  county: string;

  @ApiProperty({
    description: "Codul poștal",
    example: "010101",
    maxLength: 20,
    required: false,
  })
  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  postal_code: string;

  @ApiProperty({
    description: "Țara punctului de lucru",
    example: "Romania",
    maxLength: 100,
    default: "Romania",
  })
  @Column({
    type: "varchar",
    length: 100,
    default: "Romania",
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  country: string;

  @ApiProperty({
    description: "Numărul de telefon",
    example: "+40712345678",
    maxLength: 20,
    required: false,
  })
  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  phone_number: string;

  @ApiProperty({
    description: "Adresa de email",
    example: "location@giurom.com",
    maxLength: 255,
    required: false,
  })
  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  email: string;

  @ApiProperty({
    description: "ID-ul angajatului responsabil",
    example: 1,
    required: false,
  })
  @Column({ nullable: true })
  employee_id: number;

  @ApiProperty({
    description: "Note sau observații",
    example: "Punct de lucru principal",
    required: false,
  })
  @Column({
    type: "text",
    nullable: true,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  notes: string;

  @ApiProperty({
    description: "Latitudinea GPS a locației",
    example: 44.4268,
    required: false,
  })
  @Column({
    type: "decimal",
    precision: 10,
    scale: 6,
    nullable: true,
  })
  gps_lat: number;

  @ApiProperty({
    description: "Longitudinea GPS a locației",
    example: 26.1025,
    required: false,
  })
  @Column({
    type: "decimal",
    precision: 10,
    scale: 6,
    nullable: true,
  })
  gps_lng: number;

  @ApiProperty({
    description: "Raza GPS în metri pentru geofencing",
    example: 50,
    required: false,
  })
  @Column({
    type: "int",
    nullable: true,
  })
  gps_radius_m: number;

  @ApiProperty({
    description: "Data când a fost creată înregistrarea",
    example: "2023-12-15T10:30:00Z",
  })
  @CreateDateColumn({ type: "datetime" })
  created_at: Date;

  @ApiProperty({
    description: "Data când a fost actualizată înregistrarea",
    example: "2023-12-15T10:30:00Z",
  })
  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  // Relații
  @ApiProperty({
    description: "Compania la care aparține locația",
    type: () => Company,
  })
  @ManyToOne(() => Company, (company) => company.work_locations, {
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "company_id" })
  company: Company;

  @ApiProperty({
    description: "Template-urile de sarcini asociate acestei locații",
    type: () => [WorkLocationTaskTemplate],
  })
  @OneToMany(
    () => WorkLocationTaskTemplate,
    (taskTemplate) => taskTemplate.work_location,
    {
      cascade: true,
      eager: false,
    }
  )
  task_templates: WorkLocationTaskTemplate[];

  @ApiProperty({
    description: "Departamentele din această locație",
    type: () => [WorkLocationDepartments],
  })
  @OneToMany(
    () => WorkLocationDepartments,
    (department) => department.work_location,
    {
      cascade: true,
      eager: false,
    }
  )
  departments: WorkLocationDepartments[];
}
