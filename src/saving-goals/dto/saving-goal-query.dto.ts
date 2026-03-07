import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class SavingGoalQueryDto extends BasePaginationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    const v = Array.isArray(value) ? value[value.length - 1] : value;
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true';
    return Boolean(v);
  })
  @IsBoolean()
  isCompleted?: boolean;
}