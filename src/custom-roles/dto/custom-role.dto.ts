import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PERMISSION_IDS } from '../../common/constants/permissions';

export class CreateCustomRoleDto {
  @ApiPropertyOptional({
    description:
      "Requis pour un super admin. Pour les autres rôles, l'entreprise est celle du compte connecté.",
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ example: 'Assistant Manager' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    type: [String],
    enum: PERMISSION_IDS,
    description: 'GET /v1/roles/permissions liste les permissions disponibles.',
  })
  @IsArray()
  @IsIn(PERMISSION_IDS, { each: true })
  permissions: string[];
}

export class UpdateCustomRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ type: [String], enum: PERMISSION_IDS })
  @IsOptional()
  @IsArray()
  @IsIn(PERMISSION_IDS, { each: true })
  permissions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
