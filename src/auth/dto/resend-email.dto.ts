import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendEmailDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;
}