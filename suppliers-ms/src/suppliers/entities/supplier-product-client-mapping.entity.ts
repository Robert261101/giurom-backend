import {

  Entity,

  PrimaryGeneratedColumn,

  Column,

  CreateDateColumn,

  UpdateDateColumn,

  Index,

} from 'typeorm';



@Entity('supplier_product_client_mappings')

@Index('uq_client_supplier_product', ['client_company_id', 'supplier_product_id'], {

  unique: true,

})

@Index('idx_mapping_client_stock_product', [

  'client_company_id',

  'client_stock_product_id',

])

export class SupplierProductClientMapping {

  @PrimaryGeneratedColumn()

  id: number;



  @Column({ type: 'int' })

  client_company_id: number;



  @Column({ type: 'int' })

  supplier_product_id: number;



  /** stock.products.id — nomenclatorul companiei client */

  @Column({ type: 'int' })

  client_stock_product_id: number;



  @CreateDateColumn({ type: 'datetime' })

  created_at: Date;



  @UpdateDateColumn({ type: 'datetime' })

  updated_at: Date;

}
