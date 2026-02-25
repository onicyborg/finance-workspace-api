import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  email_username: string;

  @IsNotEmpty()
  password: string;
}