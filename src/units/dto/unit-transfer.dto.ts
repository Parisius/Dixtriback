import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UnitOwnerType } from '../schemas/unit.schema';

export class UnitTransferDto {
  @ApiProperty({ enum: UnitOwnerType })
  @IsEnum(UnitOwnerType)
  toOwnerType: UnitOwnerType;

  @ApiProperty()
  @IsString()
  toOwnerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
