import { IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { BasePaginationDto } from '../../common/dto/base-pagination.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionQueryDto extends BasePaginationDto {

  @ApiPropertyOptional({
    description: 'Filter transactions by type',
    enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
    example: 'EXPENSE',
  })
  @IsOptional()
  @IsEnum(['INCOME', 'EXPENSE', 'TRANSFER'])
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';

  @ApiPropertyOptional({
    description: 'Filter transactions by category ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions by account ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions from this date (inclusive)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions until this date (inclusive)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}