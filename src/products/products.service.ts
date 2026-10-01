import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Product, ProductDocument } from './schemas/product.schema';
import { FileAsset, FileAssetDocument } from '../files/schemas/file-asset.schema';
import { FilesService } from '../files/files.service';
import { OwnerType } from '../files/schemas/file-asset.schema';
import { TenancyService } from '../tenancy/tenancy.service';
import { Role } from '../common/constants/roles.enum';
import { UnitsService } from '../units/units.service';

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ProductsService {
  private readonly apiPrefix: string;
  private readonly configuredBaseUrl: string;

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(FileAsset.name) private fileModel: Model<FileAssetDocument>,
    private tenancy: TenancyService,
    private unitsService: UnitsService,
    private filesService: FilesService,
    config: ConfigService,
  ) {
    this.apiPrefix = config.get<string>('apiPrefix')!;
    this.configuredBaseUrl = config.get<string>('files.publicBaseUrl') || '';
  }

  /** A plain link: `url` always resolves to the file's bytes (the public
   * route for images, the authenticated route otherwise — callers already
   * hold a token for everything else on this API). `name` is whatever the
   * uploader's filename was — informational, not guaranteed. `kind` (image
   * vs document) is the one thing always meaningful to a caller deciding
   * what to do with the link. */
  private fileView(a: any, base: string) {
    return {
      url: a.isPublic
        ? `${base}/${this.apiPrefix}/files/${a._id}/public`
        : `${base}/${this.apiPrefix}/files/${a._id}/content`,
      name: a.originalName || null,
      kind: a.kind,
    };
  }

  /** Documents saved before `media` was dropped from the schema still carry
   * it (Mongo is `strict: false`, so it isn't stripped on read) — remove it
   * explicitly so the API never emits it, regardless of what's stored. */
  private plain(product: any) {
    const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };
    delete obj.media;
    return obj;
  }

  /** Every image/document attached to a product (see the Files endpoints),
   * as a plain list of links. */
  private async attachFiles<T extends { _id: unknown }>(
    product: T,
    requestBase: string,
  ): Promise<T & { files: Record<string, any>[] }> {
    const assets = await this.fileModel
      .find({ ownerType: 'product', ownerId: String((product as any)._id) })
      .sort('-createdAt')
      .lean()
      .exec();
    const base = this.configuredBaseUrl || requestBase;
    return Object.assign(this.plain(product), { files: assets.map((a) => this.fileView(a, base)) });
  }

  /** Same as attachFiles, batched: one query for every product on the page
   * instead of one per product (this backs the public storefront listing). */
  private async attachFilesToMany(products: ProductDocument[], requestBase: string) {
    if (!products.length) return [];
    const ids = products.map((p) => String(p._id));
    const assets = await this.fileModel
      .find({ ownerType: 'product', ownerId: { $in: ids } })
      .sort('-createdAt')
      .lean()
      .exec();
    const base = this.configuredBaseUrl || requestBase;
    const byOwner = new Map<string, Record<string, any>[]>();
    for (const a of assets) {
      const list = byOwner.get(a.ownerId!) ?? [];
      list.push(this.fileView(a, base));
      byOwner.set(a.ownerId!, list);
    }
    return products.map((p) => Object.assign(this.plain(p), { files: byOwner.get(String(p._id)) ?? [] }));
  }

  /**
   * `files` (optional, multipart) are uploaded right after the product is
   * created, one by one through the same pipeline as POST /files (magic-byte
   * type check, S3, FileAsset) — the product must exist first since a file's
   * ownership check looks it up by id. A bad file (wrong type, etc.) does
   * NOT roll back the product: it's reported in `fileErrors` instead, so one
   * bad image can't block the whole creation.
   */
  async create(user: AuthUser, dto: Record<string, any>, requestBase: string, files?: Express.Multer.File[]) {
    const { files: _ignored, ...rest } = dto; // never trust a client-sent `files` field
    const companyId = await this.tenancy.companyForCreate(user, rest.companyId);
    const created = await new this.productModel({ ...rest, companyId }).save();

    const fileErrors: { filename: string; error: string }[] = [];
    for (const file of files ?? []) {
      try {
        await this.filesService.upload(user, file, { ownerType: OwnerType.PRODUCT, ownerId: created.id }, requestBase);
      } catch (err: any) {
        fileErrors.push({ filename: file.originalname, error: err?.message ?? 'Échec du téléversement.' });
      }
    }

    const result = await this.attachFiles(created, requestBase);
    return fileErrors.length ? { ...result, fileErrors } : result;
  }

  /**
   * The storefront (anonymous visitors and customers, who have no company)
   * sees every company's ACTIVE products. Logged-in staff are confined to
   * their own company.
   */
  async findAll(user: AuthUser | null, query: {
    page?: number;
    limit?: number;
    companyId?: string;
    q?: string;
  }, requestBase: string) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.q) filter.name = { $regex: escapeRegex(String(query.q)), $options: 'i' };
    if (!user || user.role === Role.CUSTOMER) {
      filter.isActive = { $ne: false };
      // A customer may narrow to one company's shop, but never needs a token scope.
      if (typeof query.companyId === 'string' && query.companyId) filter.companyId = query.companyId;
    } else {
      Object.assign(filter, await this.tenancy.companyFilter(user, query.companyId));
    }
    const [rows, total] = await Promise.all([
      this.productModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);
    const data = await this.attachFilesToMany(rows, requestBase);
    return { data, total, page, limit };
  }

  async findById(user: AuthUser | null, id: string, requestBase: string) {
    const product = await this.productModel.findById(id).exec();
    if (!user || user.role === Role.CUSTOMER) {
      if (!product || product.isActive === false) throw new NotFoundException('Produit introuvable');
      return this.attachFiles(product, requestBase);
    }
    const owned = await this.tenancy.assertOwns(user, product, 'Produit introuvable');
    return this.attachFiles(owned, requestBase);
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>, requestBase: string) {
    const product = await this.productModel.findById(id).exec();
    await this.tenancy.assertOwns(user, product, 'Produit introuvable');
    const updated = await this.productModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Produit introuvable');
    return this.attachFiles(updated, requestBase);
  }

  /** One product's quantity, split the way stock actually lives: a global
   * in-stock count plus where those units currently sit (warehouse/store/
   * field agent). See UnitsService.stockByProduct for the rules. */
  async stock(user: AuthUser, id: string, companyId?: string) {
    const product = await this.productModel.findById(id).exec();
    await this.tenancy.assertOwns(user, product, 'Produit introuvable');
    return this.unitsService.stockByProduct(user, id, companyId);
  }

  async remove(user: AuthUser, id: string) {
    const product = await this.productModel.findById(id).exec();
    await this.tenancy.assertOwns(user, product, 'Produit introuvable');
    await this.productModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
