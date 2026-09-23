import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenShiftDto {
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

  @ApiProperty({ description: 'Fonds de caisse de départ (espèces déjà présentes dans le tiroir)' })
  @IsNumber()
  @Min(0)
  openingFloat: number;
}

export class CloseShiftDto {
  @ApiProperty({ description: 'Montant compté physiquement dans le tiroir à la fermeture' })
  @IsNumber()
  @Min(0)
  closingCash: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
