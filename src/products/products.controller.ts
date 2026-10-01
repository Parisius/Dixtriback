import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';

const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;
/** Read once at load: the multer limit must be static at decoration time. */
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || String(10 * 1024 * 1024), 10);
const MAX_FILES_ON_CREATE = 10;

@ApiTags('Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('products.create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sku', 'name', 'basePrice'],
      properties: {
        sku: { type: 'string' },
        name: { type: 'string' },
        category: { type: 'string' },
        basePrice: { type: 'number' },
        companyId: { type: 'string', description: "Requis pour un super admin ; sinon déduit du compte." },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: "Jusqu'à 10 images/documents, attachés au produit dès sa création (même pipeline que POST /v1/files).",
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Créer un produit (avec images/documents en option)',
    description:
      "Multipart : les champs du produit + un ou plusieurs `files`, en un seul appel — plus besoin d'un " +
      "second `POST /v1/files` juste après. Chaque fichier passe par la même vérification de type (contenu, " +
      "pas en-tête) et les mêmes règles que l'upload dédié. La réponse inclut `files` : la liste de ce qui a " +
      "été accepté — chaque entrée un simple lien `{ url, name?, kind }` — et, si un fichier a été refusé " +
      "(type non autorisé, etc.), `fileErrors: [{ filename, error }]` ; le produit est créé dans tous les cas. " +
      "Ces mêmes `files` réapparaissent ensuite sur `GET /v1/products` et `GET /v1/products/:id`.",
  })
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_ON_CREATE, { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.productsService.create(user, dto, baseUrl(req), files);
  }

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lister / rechercher les produits',
    description:
      "Vitrine e-commerce (visiteur ou client, sans connexion) : les produits actifs de toutes les " +
      "entreprises. Personnel connecté : uniquement les produits de sa propre entreprise " +
      "(super admin : toutes les entreprises). Chaque produit inclut `files` : une liste de liens " +
      "`{ url, name?, kind }` vers son image et ses documents rattachés.",
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
  @ApiOperation({
    summary: "Consulter le détail d'un produit (produit actif pour la vitrine)",
    description: "Inclut `files` : la liste des images/documents rattachés, qu'ils aient été ajoutés à la création ou via `POST /v1/files`.",
  })
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
