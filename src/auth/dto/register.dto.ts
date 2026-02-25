import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  username?: string;

  @IsOptional()
  phoneNumber?: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}