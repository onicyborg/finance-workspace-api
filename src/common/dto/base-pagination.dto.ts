import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Min } from 'class-validator';

export class BasePaginationDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value[value.length - 1] : value))
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value[value.length - 1] : value))
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toLowerCase().trim())
  search?: string;
}