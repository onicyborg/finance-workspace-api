import { IsEnum, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ example: 'Cash in Hand' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['CASH', 'BANK', 'EWALLET', 'SAVING'] })
  @IsEnum(['CASH', 'BANK', 'EWALLET', 'SAVING'])
  type: 'CASH' | 'BANK' | 'EWALLET' | 'SAVING';

  @ApiProperty({ default: 'IDR', required: false })
  @IsOptional()
  currency?: string;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;
}
