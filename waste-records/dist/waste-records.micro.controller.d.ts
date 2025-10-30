import { WasteRecordsService, CreateWasteRecordDto, UpdateWasteRecordDto } from './waste-records/waste-records.service';
export declare class WasteRecordsMicroController {
    private readonly service;
    constructor(service: WasteRecordsService);
    create(dto: CreateWasteRecordDto): Promise<import("./waste-records/entities/waste-record.entity").WasteRecord[]>;
    findAll(): Promise<import("./waste-records/entities/waste-record.entity").WasteRecord[]>;
    findOne(id: string): Promise<import("./waste-records/entities/waste-record.entity").WasteRecord>;
    update(id: string, dto: UpdateWasteRecordDto): Promise<import("./waste-records/entities/waste-record.entity").WasteRecord>;
    remove(id: string): Promise<{
        id: number;
    }>;
}
