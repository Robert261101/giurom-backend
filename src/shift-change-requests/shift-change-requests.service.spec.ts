import { Test, TestingModule } from '@nestjs/testing';
import { ShiftChangeRequestsService } from './shift-change-requests.service';

describe('ShiftChangeRequestsService', () => {
  let service: ShiftChangeRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftChangeRequestsService],
    }).compile();

    service = module.get<ShiftChangeRequestsService>(ShiftChangeRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
