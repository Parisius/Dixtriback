import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ShipmentType } from '../schemas/shipment.schema';

export class CreateShipmentDto {
  @ApiProperty()
  @IsString()
  companyId: string;

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
  rejectedQuantities?: Record<string, any>[];

  @ApiPropertyOptional({
    default: true,
    description: 'When true, one Unit is created per physical item with its own serial',
  })
  @IsOptional()
  @IsBoolean()
  generateSerials?: boolean;
}
