import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { StoreType } from '../schemas/store.schema';

export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: StoreType })
  @IsEnum(StoreType)
  type: StoreType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionId?: string;
}

export class UpdateStoreDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  address?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}
