import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttachedToType } from '../schemas/file-asset.schema';

export class UploadFileDto {
  @ApiPropertyOptional({
    enum: AttachedToType,
    description: "À quoi rattacher le fichier. Avec `attachedToId`. Sans cible : simple document de l'entreprise.",
  })
  @IsOptional()
  @IsIn(Object.values(AttachedToType))
  attachedToType?: AttachedToType;

  @ApiPropertyOptional({ description: 'Id du produit / de la boutique / de l\'entreprise / de l\'utilisateur.' })
  @IsOptional()
  @IsString()
  attachedToId?: string;

  @ApiPropertyOptional({
    description:
      "Requis pour un super admin quand aucune cible n'est indiquée (avec une cible, l'entreprise en est déduite).",
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
