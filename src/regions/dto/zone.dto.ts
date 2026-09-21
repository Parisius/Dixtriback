import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ description: "Id de la région parente (l'entreprise en est déduite)" })
  @IsString()
  regionId: string;

  @ApiProperty({ example: 'Cotonou Centre' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'COT-C' })
  @IsOptional()
  @IsString()
  code?: string;
}

/** A zone cannot be moved to another region: create a new one instead. */
export class UpdateZoneDto {
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
  @IsBoolean()
  isActive?: boolean;
}
