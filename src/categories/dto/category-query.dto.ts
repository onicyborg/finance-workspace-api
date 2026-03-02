import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class CategoryQueryDto extends BasePaginationDto {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @Transform(({ value }) => {
    const v = Array.isArray(value) ? value[value.length - 1] : value;
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true';
    return Boolean(v);
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    enumName: 'CategoryType',
    enum: ['EXPENSE', 'INCOME'],
    isArray: true,
    example: ['EXPENSE', 'INCOME'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsEnum(['EXPENSE', 'INCOME'], {
    each: true,
    message: 'Invalid category type',
  })
  @Type(() => String)
  type?: ('EXPENSE' | 'INCOME')[];
}
