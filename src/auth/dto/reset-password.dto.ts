import { IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @IsNotEmpty()
  @ApiProperty({ example: '1234567890' })
  token: string;

  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and number',
  })
  @ApiProperty({ example: 'Pa$$word123' })
  newPassword: string;
}