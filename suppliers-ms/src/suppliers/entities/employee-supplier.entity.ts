import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

@Entity('employees_suppliers')
export class EmployeeSupplier {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'int' })
  employee_id: number

  @Column({ type: 'int' })
  supplier_id: number

  @Column({ type: 'enum', enum: ['driver', 'warehouse'] })
  role: 'driver' | 'warehouse'
}
