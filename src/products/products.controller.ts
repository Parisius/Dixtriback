import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;

@ApiTags('Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('products.create')
  @ApiOperation({
    summary: 'Créer un produit',
    description:
      "La réponse inclut `files: []` (toujours vide à la création — image et documents s'ajoutent " +
      'ensuite via `POST /v1/files` avec `ownerType=product`, `ownerId=<id du produit>`).',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto, @Req() req: Request) {
    return this.productsService.create(user, dto, baseUrl(req));
  }

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lister / rechercher les produits',
    description:
      "Vitrine e-commerce (visiteur ou client, sans connexion) : les produits actifs de toutes les " +
      "entreprises. Personnel connecté : uniquement les produits de sa propre entreprise " +
      "(super admin : toutes les entreprises). Chaque produit inclut `files` (image et documents " +
      "rattachés) en plus de `media` (URLs publiques des images, conservé pour compatibilité).",
  })
  findAll(
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
  ) {
    return this.productsService.findAll(user, { page, limit, companyId, q }, baseUrl(req));
  }

  @Get(':id')
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Consulter le détail d'un produit (produit actif pour la vitrine)" })
  findOne(@CurrentUser() user: AuthUser | null, @Param('id') id: string, @Req() req: Request) {
    return this.productsService.findById(user, id, baseUrl(req));
  }

  @Get(':id/stock')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Quantité en stock d'un produit : global, par entrepôt, par boutique",
    description:
      "`totalInStock` (global, toute l'entreprise), `byWarehouse`, `byStore` et `byFieldAgent` " +
      "(unités actuellement chez un agent terrain). Le stock d'une boutique est toujours un sous-" +
      "ensemble des unités reçues en entrepôt puis transférées — jamais un total séparé.",
  })
  stock(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('companyId') companyId?: string) {
    return this.productsService.stock(user, id, companyId);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('products.update')
  @ApiOperation({ summary: 'Mettre à jour un produit' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: Request) {
    return this.productsService.update(user, id, dto, baseUrl(req));
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('products.delete')
  @ApiOperation({ summary: 'Désactiver un produit' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.productsService.remove(user, id);
  }
}
