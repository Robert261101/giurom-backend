// This is a lightweight reference class for product data from the stock service
// It should not create a table in this database, only used for data mapping
export class ProductRef {
  id: number;
  name: string;
  unit: string;
  created_at: string;
  updated_at: string;
}