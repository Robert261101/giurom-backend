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

  /** Soft-block for furnizor staff quotas; inactive links do not consume slots. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean
}
