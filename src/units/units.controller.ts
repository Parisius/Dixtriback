import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { UnitTransferDto } from './dto/unit-transfer.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les unités sérialisées' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('ownerType') ownerType?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.unitsService.findAll(user, { page, limit, ownerType, status, companyId });
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une unité" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.unitsService.findById(user, id);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: "Transférer la propriété d'une unité" })
  transfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UnitTransferDto) {
    return this.unitsService.transfer(user, id, dto.toOwnerType, dto.toOwnerId, dto.note);
  }

  @Get(':serial/trace')
  @ApiOperation({ summary: "Traçabilité complète d'une unité par son numéro de série" })
  trace(@CurrentUser() user: AuthUser, @Param('serial') serial: string) {
    return this.unitsService.trace(user, serial);
  }
}
