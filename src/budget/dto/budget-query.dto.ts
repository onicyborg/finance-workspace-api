import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class BudgetQueryDto extends BasePaginationDto {
  @ApiProperty({ required: false, example: 3, minimum: 1, maximum: 12 })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value[value.length - 1] : value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ required: false, example: 2026, minimum: 2000 })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value[value.length - 1] : value))
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;
}