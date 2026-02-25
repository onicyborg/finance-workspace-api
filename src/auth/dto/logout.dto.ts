import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @IsNotEmpty()
  @ApiProperty({ example: '1234567890' })
  refreshToken: string;
}
