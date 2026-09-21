import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { StoreType } from '../schemas/store.schema';

export class CreateStoreDto {
  @ApiPropertyOptional({
    description:
      "Requis pour un super admin (l'une de ses entreprises). Pour les autres rôles, l'entreprise est celle du compte connecté.",
  })
  @IsOptional()
  @IsString()
  companyId?: string;

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

  @ApiPropertyOptional({ description: "Id d'une région de la même entreprise (POST /v1/regions)" })
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional({
    description: "Id d'une zone (subdivision de la région). Doit appartenir à `regionId` ; si `regionId` est omis, il est déduit de la zone.",
  })
  @IsOptional()
  @IsString()
  zoneId?: string;
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
