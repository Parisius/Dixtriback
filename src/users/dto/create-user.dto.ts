import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/constants/roles.enum';

/**
 * Only these fields are validated. Any other property sent in the request
 * body is neither rejected nor stripped — see main.ts (ValidationPipe with
 * whitelist: false) and the schema's `strict: false` — it is persisted as-is
 * on the User document. Use this for anything not yet modeled explicitly
 * (e.g. a one-off HR field, a badge number, a pilot-program flag).
 */
export class CreateUserDto {
  @ApiPropertyOptional({ description: 'null for Super Admin / platform-level accounts' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: "Id d'une région de la même entreprise (POST /v1/regions)" })
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional({
    description: "Id d'une zone (subdivision de la région). Doit appartenir à `regionId` ; si `regionId` est omis, il est déduit de la zone.",
  })
  @IsOptional()
  @IsString()
  zoneId?: string;
}
