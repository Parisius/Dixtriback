import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRegionDto {
  @ApiPropertyOptional({
    description:
      "Requis pour un super admin. Pour les autres rôles, l'entreprise est celle du compte connecté.",
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ example: 'Littoral' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'LIT' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'BJ' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class UpdateRegionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
