import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto, ReceiveShipmentDto } from './dto/shipment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Procurement')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: 'Enregistrer une expédition (conteneur/cargo/balle)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Suivre les expéditions' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.shipmentsService.findAll(user, page, limit, companyId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une expédition' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.shipmentsService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @ApiOperation({ summary: "Mettre à jour une expédition (statut, manifeste, coûts)" })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.shipmentsService.update(user, id, dto);
  }

  @Post(':id/receive')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.WAREHOUSE_MANAGER)
  @ApiOperation({
    summary: 'Réceptionner une expédition : inspection, éclatement des lots, sérialisation',
  })
  receive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReceiveShipmentDto) {
    return this.shipmentsService.receive(user, id, dto);
  }
}
