import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsNotEmpty()
  @ApiProperty({ example: 'user@example.com' })
  email_username: string;

  @IsNotEmpty()
  @ApiProperty({ example: 'password' })
  password: string;
}