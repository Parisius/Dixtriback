import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WarehouseTier } from '../schemas/warehouse.schema';

export class CreateWarehouseDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: WarehouseTier })
  @IsEnum(WarehouseTier)
  tier: WarehouseTier;

  @ApiPropertyOptional({ description: 'Required when tier = regional' })
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;
}

export class TransferStockDto {
  @ApiProperty()
  @IsString()
  toType: 'warehouse' | 'field_agent' | 'store';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toStoreId?: string;

  @ApiProperty({ type: [String], description: 'Serialized unit ids being transferred' })
  unitIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
