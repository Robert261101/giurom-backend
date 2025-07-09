import { PartialType } from '@nestjs/swagger';
import { CreateStockTransactionDto } from './create-stock-transaction.dto';

export class UpdateStockTransactionDto extends PartialType(CreateStockTransactionDto) {} 