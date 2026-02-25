import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmEmailDto {
  @IsNotEmpty()
  @ApiProperty({ example: '1234567890' })
  token: string;
}