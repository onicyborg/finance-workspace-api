import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class MonthlyReportQueryDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @IsNotEmpty({ message: 'month is required' })
  @Transform(({ value }) => (Array.isArray(value) ? value[value.length - 1] : value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026, minimum: 2000 })
  @IsNotEmpty({ message: 'year is required' })
  @Transform(({ value }) => (Array.isArray(value) ? value[value.length - 1] : value))
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;
}