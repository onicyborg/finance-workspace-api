import { IsEnum, IsOptional, IsUUID, IsNumber, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransactionDto {

  @ApiPropertyOptional({
    description: 'Transaction type',
    enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
    example: 'EXPENSE',
  })
  @IsOptional()
  @IsEnum(['INCOME', 'EXPENSE', 'TRANSFER'])
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';

  @ApiPropertyOptional({
    description: 'Source account ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Destination account ID (for TRANSFER type only)',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @ApiPropertyOptional({
    description: 'Transaction amount',
    example: 100.50,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Category ID (not required for TRANSFER type)',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Transaction description',
    example: 'Grocery shopping at supermarket',
  })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Transaction date (ISO format)',
    example: '2024-03-03T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}