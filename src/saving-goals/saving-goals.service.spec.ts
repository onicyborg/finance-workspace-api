import { Test, TestingModule } from '@nestjs/testing';
import { SavingGoalsService } from './saving-goals.service';

describe('SavingGoalsService', () => {
  let service: SavingGoalsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SavingGoalsService],
    }).compile();

    service = module.get<SavingGoalsService>(SavingGoalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
