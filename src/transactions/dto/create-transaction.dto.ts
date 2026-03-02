import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({ 
    enum: ['INCOME', 'EXPENSE', 'TRANSFER'],
    description: 'Type of transaction',
    example: 'EXPENSE'
  })
  @IsEnum(['INCOME', 'EXPENSE', 'TRANSFER'])
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';

  @ApiProperty({ 
    description: 'Source account ID (from account)',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  accountId: string; // from account

  @ApiProperty({ 
    description: 'Destination account ID (required only for TRANSFER type)',
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false
  })
  @IsOptional()
  @IsUUID()
  toAccountId?: string; // required if TRANSFER

  @ApiProperty({ 
    description: 'Transaction amount',
    example: 100.50,
    minimum: 0.01
  })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ 
    description: 'Category ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    required: false
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ 
    description: 'Transaction description (optional)',
    example: 'Lunch at restaurant',
    required: false
  })
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    description: 'Date of transaction',
    example: '2024-03-02T10:30:00.000Z',
    format: 'date-time',
    required: false
  })
  @IsOptional()
  transactionDate?: Date;
}