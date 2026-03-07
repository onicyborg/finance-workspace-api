import { PartialType } from '@nestjs/swagger';
import { CreateSavingGoalDto } from './create-saving-goal.dto';

export class UpdateSavingGoalDto extends PartialType(CreateSavingGoalDto) {}