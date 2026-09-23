import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';
import { OrderDocument, PaymentMethod } from './schemas/order.schema';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { Store, StoreDocument } from '../stores/schemas/store.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

const PAYMENT_LABEL: Record<string, string> = {
  [PaymentMethod.CASH]: 'Espèces',
  [PaymentMethod.CARD]: 'Carte',
  [PaymentMethod.MOBILE_MONEY]: 'Mobile Money',
  [PaymentMethod.CREDIT]: 'Crédit',
  [PaymentMethod.INSTALLMENT]: 'Échelonné',
};

const money = (n: number, currency: string) => `${(n ?? 0).toFixed(2)} ${currency}`;

@Injectable()
export class ReceiptService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Renders a PDF receipt for a sale. Assumes the caller already checked
   * that `order` is one this user may see (OrdersService.findById). */
  async render(order: OrderDocument): Promise<Buffer> {
    const [company, store, cashier, customer, products] = await Promise.all([
      this.companyModel.findById(order.companyId).lean().exec(),
      order.storeId ? this.storeModel.findById(order.storeId).lean().exec() : null,
      order.cashierId ? this.userModel.findById(order.cashierId).select('name').lean().exec() : null,
      order.customerId ? this.customerModel.findById(order.customerId).select('name').lean().exec() : null,
      this.productModel
        .find({ _id: { $in: order.lines.map((l) => l.productId) } })
        .select('name sku')
        .lean()
        .exec(),
    ]);
    if (!company) throw new NotFoundException('Entreprise introuvable pour cette commande.');
    const productById = new Map(products.map((p: any) => [String(p._id), p]));
    const currency = company.currency || 'XOF';

    const doc = new PDFDocument({ size: 'A5', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(16).text(company.name, { align: 'center' });
    if (store) doc.fontSize(10).fillColor('#555').text(store.name, { align: 'center' });
    doc.moveDown(0.5).fillColor('#000');

    doc.fontSize(9).fillColor('#333');
    doc.text(`Reçu : ${order.id}`);
    doc.text(`Date : ${new Date((order as any).createdAt).toLocaleString('fr-FR')}`);
    if (cashier) doc.text(`Caissier : ${cashier.name}`);
    if (customer) doc.text(`Client : ${customer.name}`);
    if (order.status === 'returned') {
      doc.fillColor('#b00').text('COMMANDE RETOURNÉE / REMBOURSÉE').fillColor('#333');
    }
    doc.moveDown(0.5).fillColor('#000');

    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.3);

    doc.fontSize(9);
    for (const line of order.lines) {
      const product = productById.get(String(line.productId));
      const label = product ? `${product.name}${product.sku ? ` (${product.sku})` : ''}` : String(line.productId);
      doc.font('Helvetica-Bold').text(label);
      doc
        .font('Helvetica')
        .text(
          `  ${line.quantity} x ${money(line.unitPrice, currency)}` +
            (line.discountAmount ? `  −${money(line.discountAmount, currency)} remise` : '') +
            `  =  ${money(line.quantity * line.unitPrice - (line.discountAmount || 0), currency)}`,
        );
    }

    doc.moveDown(0.5);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.3);

    doc.text(`Sous-total : ${money(order.subtotal, currency)}`);
    if (order.discountTotal) doc.text(`Remise totale : −${money(order.discountTotal, currency)}`);
    doc.font('Helvetica-Bold').fontSize(12).text(`Total : ${money(order.total, currency)}`);
    doc.font('Helvetica').fontSize(9).moveDown(0.3);

    doc.text('Paiement :');
    for (const p of order.payments) {
      doc.text(`  ${PAYMENT_LABEL[p.method] ?? p.method} : ${money(p.amount, currency)}`);
    }

    doc.moveDown(1).fontSize(8).fillColor('#777').text('Merci de votre achat.', { align: 'center' });

    doc.end();
    return done;
  }
}
