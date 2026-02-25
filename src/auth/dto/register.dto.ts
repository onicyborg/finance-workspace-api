import { IsEmail, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @IsNotEmpty()
  @ApiProperty({ example: 'John Doe' })
  name: string;

  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  @Matches(/^[a-z0-9._]{5,20}$/, {
    message:
      'Username must be 5-20 characters, lowercase alphanumeric, underscore or dot only',
  })
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone number must be in E.164 format (e.g. +628123456789)',
  })
  @ApiProperty({ example: '+628123456789' })
  phoneNumber: string;

  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and number',
  })
  @ApiProperty({ example: 'Pa$$word123' })
  password: string;
}
