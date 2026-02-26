import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberDto {
  @ApiProperty({ enum: ['EDITOR', 'VIEWER'] })
  @IsEnum(['EDITOR', 'VIEWER'], {
    message: 'Role must be either EDITOR or VIEWER',
  })
  role: 'EDITOR' | 'VIEWER';
}