import { IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiProperty({ example: 'Personal Finance' })
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'Finance tracking with my partner', required: false })
  @IsOptional()
  @MaxLength(500)
  description?: string;
}