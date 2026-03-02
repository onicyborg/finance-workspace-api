import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';

export class AccountQueryDto extends BasePaginationDto {
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
    enumName: 'AccountType',
    enum: ['CASH', 'BANK', 'EWALLET', 'SAVING'],
    isArray: true,
    example: ['CASH', 'BANK'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsEnum(['CASH', 'BANK', 'EWALLET', 'SAVING'], {
    each: true,
    message: 'Invalid account type',
  })
  @Type(() => String)
  type?: ('CASH' | 'BANK' | 'EWALLET' | 'SAVING')[];

  @ApiProperty({
    required: false,
    type: 'string',
    example: 'IDR',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}
