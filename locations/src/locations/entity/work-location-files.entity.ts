import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { WorkLocation } from "./work-location.entity";
import { WorkLocationFolder } from "./work-location-folder.entity";

@Entity("work_location_files")
export class WorkLocationFiles {
  @ApiProperty({
    description: "ID-ul unic al fișierului",
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: "ID-ul locației",
    example: 1,
  })
  @Column()
  work_location_id: number;

  @ApiProperty({
    description: "ID-ul folderului (opțional)",
    example: 1,
    required: false,
  })
  @Column({ type: "int", nullable: true })
  folder_id: number | null;

  @ApiProperty({
    description: "Numele fișierului",
    example: "Contract_Locatie_1.pdf",
    maxLength: 255,
  })
  @Column({
    type: "varchar",
    length: 255,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  file_name: string;

  @ApiProperty({
    description: "Tipul fișierului",
    example: "pdf",
    maxLength: 100,
  })
  @Column({
    type: "varchar",
    length: 100,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  file_type: string;

  @ApiProperty({
    description: "Link-ul către fișier",
    example: "/files/locations/1/document.pdf",
    maxLength: 255,
  })
  @Column({
    type: "varchar",
    length: 255,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  file_link: string;

  @Column({ type: "datetime", nullable: true, default: null })
  expire_date: Date | null;

  @ApiProperty({
    description: "Note despre fișier",
    example:
      "|folder:Contract de Închiriere locație| Document încărcat la 15.11.2023",
    required: false,
  })
  @Column({
    type: "varchar",
    length: 1000,
    nullable: true,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
  })
  notes: string | null;

  @ApiProperty({
    description: "Data ultimei actualizări",
    example: "2023-12-15T14:30:00Z",
  })
  @UpdateDateColumn({ type: "datetime" })
  updated_at: Date;

  @ManyToOne(() => WorkLocation, (location) => location.location_files)
  @JoinColumn({ name: "work_location_id" })
  workLocation: WorkLocation;

  @ManyToOne(() => WorkLocationFolder, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "folder_id" })
  folder: WorkLocationFolder | null;
}
