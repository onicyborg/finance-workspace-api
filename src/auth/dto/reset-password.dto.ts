import { IsNotEmpty, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and number',
  })
  newPassword: string;
}