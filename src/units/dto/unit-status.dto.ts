import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { UnitStatus } from '../schemas/unit.schema';

export const MANUAL_UNIT_STATUSES = [UnitStatus.DAMAGED, UnitStatus.WRITTEN_OFF, UnitStatus.IN_STOCK];

export class UnitStatusDto {
  @ApiProperty({
    enum: MANUAL_UNIT_STATUSES,
    description:
      "damaged / written_off : l'unité sort du stock vendable (elle reste rattachée à son entrepôt/boutique pour la traçabilité). " +
      'in_stock : remise en stock, uniquement depuis damaged (réparée / retrouvée). written_off est définitif.',
  })
  @IsIn(MANUAL_UNIT_STATUSES)
  status: UnitStatus;

  @ApiProperty({ example: 'Écran fissuré à la réception', description: 'Motif obligatoire, conservé dans l\'historique.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
