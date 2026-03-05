import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 'uuid-category-id' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ example: 2026, minimum: 2000 })
  @IsInt()
  @Min(2000)
  @Type(() => Number)
  year: number;

  @ApiProperty({ example: 500000 })
  @IsPositive()
  @Type(() => Number)
  amount: number;
}
