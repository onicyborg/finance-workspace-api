import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export type GroupBy = 'day' | 'week' | 'month' | 'category' | 'account';
export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export class CustomReportDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({
    required: false,
    isArray: true,
    example: ['uuid-account-1', 'uuid-account-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  accountIds?: string[];

  @ApiProperty({
    required: false,
    isArray: true,
    example: ['uuid-category-1'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  categoryIds?: string[];

  @ApiProperty({
    required: false,
    isArray: true,
    enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
    example: ['INCOME', 'EXPENSE'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['INCOME', 'EXPENSE', 'TRANSFER'], { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  types?: TransactionType[];

  @ApiProperty({
    required: false,
    enum: ['day', 'week', 'month', 'category', 'account'],
    example: 'category',
    default: 'day',
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'category', 'account'])
  groupBy?: GroupBy = 'day';
}
