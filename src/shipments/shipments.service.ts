import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shipment, ShipmentDocument, ShipmentStatus } from './schemas/shipment.schema';
import { UnitsService } from '../units/units.service';
import { ReceiveShipmentDto } from './dto/shipment.dto';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    private unitsService: UnitsService,
    private tenancy: TenancyService,
  ) {}

  async create(user: AuthUser, dto: Record<string, any>) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    this.validateManifest(dto.manifest);
    return new this.shipmentModel({ ...dto, companyId }).save();
  }

  /** Catches the empty-or-quantityless manifest at creation/update time,
   * instead of letting it through and only failing later at /receive —
   * each line needs a productId and a quantity > 0. */
  private validateManifest(manifest: unknown) {
    if (!Array.isArray(manifest) || manifest.length === 0) {
      throw new BadRequestException('Le manifeste doit contenir au moins une ligne (productId, quantity, unitCost).');
    }
    for (const line of manifest) {
      if (!line?.productId) {
        throw new BadRequestException('Chaque ligne du manifeste doit avoir un "productId".');
      }
      if (!(Number(line?.quantity) > 0)) {
        throw new BadRequestException(`Ligne invalide pour le produit ${line.productId} : "quantity" doit être un nombre supérieur à 0.`);
      }
    }
  }

  async findAll(user: AuthUser, page = 1, limit = 20, companyId?: string, status?: string) {
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    Object.assign(filter, await this.tenancy.companyFilter(user, companyId));
    const [data, total] = await Promise.all([
      this.shipmentModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.shipmentModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page: Number(page), limit: Number(limit) };
  }

  async findById(user: AuthUser, id: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    return this.tenancy.assertOwns(user, shipment, 'Expédition introuvable');
  }

  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    await this.findById(user, id);
    if (dto.manifest !== undefined) this.validateManifest(dto.manifest);
    const updated = await this.shipmentModel
      .findByIdAndUpdate(id, { $set: this.tenancy.stripImmutable(dto) }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Expédition introuvable');
    return updated;
  }

  /**
   * Hard delete — but only while nothing real-world has happened yet.
   * `receive()` is the only thing that moves a shipment off `ordered` (and
   * the only thing that creates units), so "still ordered" alone guarantees
   * no unit anywhere has this shipment as its origin. Once it's past that,
   * deleting would orphan those units' traceability, so it's refused.
   */
  async remove(user: AuthUser, id: string) {
    const shipment = await this.findById(user, id);
    if (shipment.status !== ShipmentStatus.ORDERED) {
      throw new ConflictException(
        `Impossible de supprimer : cette expédition est déjà au statut "${shipment.status}". Seule une expédition encore "ordered" (jamais réceptionnée) peut être supprimée.`,
      );
    }
    await this.shipmentModel.deleteOne({ _id: id }).exec();
  }

  /**
   * Receiving & inspection, breaking bulk, and unit-level serialization —
   * all in one step, matching the locked architecture (Section 2.3 of the
   * spec). Landed cost is the shipment's total cost (goods + freight +
   * duties + handling) spread evenly across every accepted unit.
   */
  async receive(user: AuthUser, id: string, dto: ReceiveShipmentDto) {
    const shipment = await this.findById(user, id);

    if (dto.inspectionResult === 'rejected') {
      shipment.status = ShipmentStatus.INSPECTED;
      await shipment.save();
      return { unitsCreated: 0, shipment };
    }

    const { freight = 0, duties = 0, handling = 0 } = shipment.landedCosts || {};
    const goodsCost = shipment.manifest.reduce(
      (sum, line) => sum + (line.quantity || 0) * (line.unitCost || 0),
      0,
    );
    const totalCost = goodsCost + freight + duties + handling;
    const totalUnits = shipment.manifest.reduce((sum, line) => sum + (line.quantity || 0), 0);
    if (totalUnits <= 0) {
      throw new BadRequestException('Le manifeste ne contient aucune quantité à réceptionner.');
    }
    const landedUnitCost = totalCost / totalUnits;

    const unitsToCreate: Array<{
      companyId: string;
      productId: string;
      shipmentId: string;
      landedUnitCost: number;
      ownerId: string;
    }> = [];

    for (const line of shipment.manifest) {
      const qty = line.quantity || 0;
      for (let i = 0; i < qty; i++) {
        unitsToCreate.push({
          companyId: shipment.companyId.toString(),
          productId: line.productId,
          shipmentId: shipment.id,
          landedUnitCost,
          ownerId: shipment.destinationWarehouseId.toString(),
        });
      }
    }

    const created =
      dto.generateSerials === false ? [] : await this.unitsService.createBatch(unitsToCreate);

    shipment.status = ShipmentStatus.PUT_AWAY;
    await shipment.save();

    return { unitsCreated: created.length, shipment };
  }
}
