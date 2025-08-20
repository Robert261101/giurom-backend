import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('companies')
export class CompanyRef {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  company_name: string;
}


