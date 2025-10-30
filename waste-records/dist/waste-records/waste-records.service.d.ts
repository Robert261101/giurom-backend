import { Repository } from 'typeorm';
import { WasteRecord } from './entities/waste-record.entity';
export interface CreateWasteRecordDto {
    product_id?: number;
    recipe_id?: number;
    quantity: number;
    unit: string;
    reason?: string;
}
export interface UpdateWasteRecordDto extends Partial<CreateWasteRecordDto> {
}
export declare class WasteRecordsService {
    private readonly repo;
    constructor(repo: Repository<WasteRecord>);
    create(dto: CreateWasteRecordDto): Promise<WasteRecord[]>;
    findAll(): Promise<WasteRecord[]>;
    findOne(id: number): Promise<WasteRecord>;
    update(id: number, dto: UpdateWasteRecordDto): Promise<WasteRecord>;
    remove(id: number): Promise<{
        id: number;
    }>;
}
