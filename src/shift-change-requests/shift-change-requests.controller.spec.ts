import { Test, TestingModule } from '@nestjs/testing';
import { ShiftChangeRequestsController } from './shift-change-requests.controller';

describe('ShiftChangeRequestsController', () => {
  let controller: ShiftChangeRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShiftChangeRequestsController],
    }).compile();

    controller = module.get<ShiftChangeRequestsController>(ShiftChangeRequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
