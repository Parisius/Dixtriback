import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType, PaymentMethod } from '../schemas/order.schema';

/** POS payments never carry credit/installment — that's a Field Agent-only capability (locked decision). */
const POS_PAYMENT_METHODS = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOBILE_MONEY];

export class DiscountDto {
  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({ description: 'Pourcentage (0-100) si type=percent, montant sinon' })
  @IsNumber()
  @Min(0)
  value: number;
}

export class OrderLineDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Remise sur cette ligne uniquement' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;
}

export class OrderPaymentDto {
  @ApiProperty({ enum: POS_PAYMENT_METHODS })
  @IsIn(POS_PAYMENT_METHODS)
  method: PaymentMethod;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    description:
      "Requis pour un super admin (l'une de ses entreprises). Pour les autres rôles, l'entreprise est celle du compte connecté.",
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty()
  @IsString()
  storeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines: OrderLineDto[];

  @ApiPropertyOptional({ description: 'Remise sur le total de la vente, en plus des remises par ligne' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;

  @ApiProperty({
    type: [OrderPaymentDto],
    description:
      "Un ou plusieurs paiements (paiement fractionné possible) ; la somme des montants doit " +
      "égaler le total de la vente. Comptant/carte/mobile money uniquement — jamais de crédit en boutique.",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderPaymentDto)
  payments: OrderPaymentDto[];
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
