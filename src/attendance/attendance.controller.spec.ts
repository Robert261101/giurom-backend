import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        {
          provide: AttendanceService,
          useValue: {
            createShift: jest.fn(),
            findAllShifts: jest.fn(),
            findOneShift: jest.fn(),
            updateShift: jest.fn(),
            removeShift: jest.fn(),
            createPresence: jest.fn(),
            findAllPresences: jest.fn(),
            findOnePresence: jest.fn(),
            updatePresence: jest.fn(),
            removePresence: jest.fn(),
            createPresenceInflexion: jest.fn(),
            findAllPresenceInflexions: jest.fn(),
            findOnePresenceInflexion: jest.fn(),
            updatePresenceInflexion: jest.fn(),
            removePresenceInflexion: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(require('@nestjs/throttler').ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
