import { Test, TestingModule } from '@nestjs/testing';
import { SavingGoalsController } from './saving-goals.controller';

describe('SavingGoalsController', () => {
  let controller: SavingGoalsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavingGoalsController],
    }).compile();

    controller = module.get<SavingGoalsController>(SavingGoalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
