import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OwnerType } from '../schemas/file-asset.schema';

export class UploadFileDto {
  @ApiPropertyOptional({
    enum: OwnerType,
    description: "À quoi rattacher le fichier. Avec `ownerId`. Sans propriétaire : simple document de l'entreprise.",
  })
  @IsOptional()
  @IsIn(Object.values(OwnerType))
  ownerType?: OwnerType;

  @ApiPropertyOptional({ description: 'Id du produit / de la boutique / de l\'entreprise / de l\'utilisateur.' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description:
      "Requis pour un super admin quand aucun propriétaire n'est indiqué (avec un propriétaire, l'entreprise en est déduite).",
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 'logo', description: 'Libellé libre : logo, avatar, gallery, invoice…' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  purpose?: string;
}
