import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsIn, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { WarehouseTier } from '../schemas/warehouse.schema';

export class CreateWarehouseDto {
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

  @ApiProperty({ enum: WarehouseTier })
  @IsEnum(WarehouseTier)
  tier: WarehouseTier;

  @ApiPropertyOptional({ description: 'Required when tier = regional' })
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional({
    description: "Id d'une zone (subdivision de la région). Doit appartenir à `regionId` ; si `regionId` est omis, il est déduit de la zone.",
  })
  @IsOptional()
  @IsString()
  zoneId?: string;

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
  @ApiProperty({ enum: ['warehouse', 'store', 'field_agent'] })
  @IsIn(['warehouse', 'store', 'field_agent'])
  toType: 'warehouse' | 'field_agent' | 'store';

  @ApiPropertyOptional({ description: 'Requis si toType = warehouse' })
  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @ApiPropertyOptional({ description: 'Requis si toType = store' })
  @IsOptional()
  @IsString()
  toStoreId?: string;

  @ApiPropertyOptional({ description: "Requis si toType = field_agent : id d'un utilisateur de rôle field_agent de la même entreprise" })
  @IsOptional()
  @IsString()
  toAgentId?: string;

  @ApiProperty({
    type: [String],
    description:
      "Unités à transférer. Elles doivent être en stock DANS cet entrepôt ; tout ou rien : si une seule est invalide, aucune ne bouge.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  unitIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
