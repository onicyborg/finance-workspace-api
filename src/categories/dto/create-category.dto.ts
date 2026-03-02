import { IsEnum, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Food & Dining',
    maxLength: 100
  })
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: ['INCOME', 'EXPENSE'],
    description: 'Category type',
    example: 'EXPENSE'
  })
  @IsEnum(['INCOME', 'EXPENSE'])
  type: 'INCOME' | 'EXPENSE';

  @ApiProperty({
    description: 'Category icon (optional)',
    example: '🍔',
    required: false
  })
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Category color in hex format (optional)',
    example: '#FF6B6B',
    required: false
  })
  @IsOptional()
  color?: string;
}
