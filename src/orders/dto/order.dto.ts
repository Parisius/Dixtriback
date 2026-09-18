import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethod } from '../schemas/order.schema';

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  companyId: string;

  @ApiProperty()
  @IsString()
  storeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({
    type: [Object],
    description: 'Lines: { productId, quantity, unitPrice }',
  })
  @IsArray()
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;

  @ApiProperty({
    enum: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOBILE_MONEY],
    description: 'Store POS is cash/card/mobile money only — no credit (locked decision)',
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ description: "Ex: 'returned' pour un retour/remboursement" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  note?: string;
}
