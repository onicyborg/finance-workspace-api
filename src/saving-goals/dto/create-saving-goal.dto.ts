import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateSavingGoalDto {
  @ApiProperty({ example: 'Beli Laptop' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'uuid-account-id' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ example: 10000000 })
  @IsPositive()
  @Type(() => Number)
  targetAmount: number;

  @ApiProperty({ example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}