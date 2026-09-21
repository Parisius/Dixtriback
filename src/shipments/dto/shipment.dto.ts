import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ShipmentType } from '../schemas/shipment.schema';
import { Type } from 'class-transformer';

export class CreateShipmentDto {
  @ApiPropertyOptional({
    description:
      "Requis pour un super admin (l'une de ses entreprises). Pour les autres rôles, l'entreprise est celle du compte connecté.",
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiProperty()
  @IsString()
  supplierId: string;

  @ApiProperty({ enum: ShipmentType })
  @IsEnum(ShipmentType)
  type: ShipmentType;

  @ApiProperty({
    type: [Object],
    description: 'Manifest lines: { productId, quantity, unitCost, ... }',
  })
  @IsArray()
  // explicit type: without it, implicit conversion turns each object item into []
  @Type(() => Object)
  manifest: Record<string, any>[];

  @ApiProperty()
  @IsString()
  destinationWarehouseId: string;
}

export class ReceiveShipmentDto {
  @ApiProperty({ enum: ['passed', 'partial_reject', 'rejected'] })
  @IsString()
  inspectionResult: 'passed' | 'partial_reject' | 'rejected';

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  // explicit type: without it, implicit conversion turns each object item into []
  @Type(() => Object)
  rejectedQuantities?: Record<string, any>[];

  @ApiPropertyOptional({
    default: true,
    description: 'When true, one Unit is created per physical item with its own serial',
  })
  @IsOptional()
  @IsBoolean()
  generateSerials?: boolean;
}
