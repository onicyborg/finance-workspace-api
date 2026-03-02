import { IsOptional, MaxLength, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Food & Dining',
    maxLength: 100,
    required: false
  })
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Category icon',
    example: '🍔',
    required: false
  })
  @IsOptional()
  icon?: string;

  @ApiProperty({
    description: 'Category color in hex format',
    example: '#FF6B6B',
    required: false
  })
  @IsOptional()
  color?: string;

  @ApiProperty({
    description: 'Category active status',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}