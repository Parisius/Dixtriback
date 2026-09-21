import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('logs')
export class LogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: "Journal d'activité",
    description:
      "Admin d'entreprise : toutes les actions de SON entreprise. Super admin : les actions de toutes les " +
      "entreprises (`companyId=<id>` pour une seule, `companyId=none` pour les événements hors entreprise, " +
      "ex. connexions échouées). Couvre toutes les écritures (création, modification, suppression, actions " +
      "métier) et les événements d'authentification, réussis ou non. Les lectures ne sont pas journalisées. " +
      "Lecture seule ; conservation : 365 jours par défaut.",
  })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'actorId', required: false, description: "Id de l'utilisateur auteur" })
  @ApiQuery({ name: 'resource', required: false, description: 'ex. orders, users, stores, auth' })
  @ApiQuery({ name: 'action', required: false, description: 'ex. orders.create, shipments.receive, auth.login' })
  @ApiQuery({ name: 'method', required: false, enum: ['POST', 'PUT', 'PATCH', 'DELETE'] })
  @ApiQuery({ name: 'success', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'from', required: false, description: 'Date ISO, ex. 2026-09-01' })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false, description: 'max 100' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>) {
    return this.auditService.findAll(user, query);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Détail d'une entrée du journal" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auditService.findById(user, id);
  }
}
