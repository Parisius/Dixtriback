/* eslint-disable no-console */
import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema } from '../users/schemas/user.schema';
import { CompanySchema } from '../companies/schemas/company.schema';
import { WarehouseSchema, WarehouseTier } from '../warehouses/schemas/warehouse.schema';
import { StoreSchema, StoreType } from '../stores/schemas/store.schema';
import { RegionSchema } from '../regions/schemas/region.schema';
import { Role } from '../common/constants/roles.enum';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/multicompany_commerce';
  await mongoose.connect(uri);
  console.log(`Connecté à ${uri}`);

  const UserModel = mongoose.model('User', UserSchema);
  const CompanyModel = mongoose.model('Company', CompanySchema);
  const WarehouseModel = mongoose.model('Warehouse', WarehouseSchema);
  const StoreModel = mongoose.model('Store', StoreSchema);
  const RegionModel = mongoose.model('Region', RegionSchema);

  const existing = await UserModel.findOne({ email: 'admin@example.com' });
  if (existing) {
    console.log('Le seed a déjà été exécuté (admin@example.com existe). Rien à faire.');
    await mongoose.disconnect();
    return;
  }

  const company = await CompanyModel.create({
    name: 'Ma Première Entreprise',
    legalName: 'Ma Première Entreprise SARL',
    countries: ['BJ'],
    currency: 'XOF',
  });
  console.log('Entreprise créée:', company.id);

  const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
  const superAdmin = await UserModel.create({
    companyId: null,
    role: Role.SUPER_ADMIN,
    name: 'Super Admin',
    email: 'admin@example.com',
    passwordHash,
    isActive: true,
  });
  console.log('Super Admin créé:', superAdmin.email, '(mot de passe: ChangeMe123!)');

  // The super admin is linked to the companies they create (Company.createdBy).
  await CompanyModel.updateOne({ _id: company._id }, { createdBy: superAdmin._id });

  const region = await RegionModel.create({
    companyId: company.id,
    name: 'Littoral',
    code: 'LIT',
    country: 'BJ',
  });
  console.log('Région créée:', region.id);

  const countryWarehouse = await WarehouseModel.create({
    companyId: company.id,
    name: 'Entrepôt National — Cotonou',
    tier: WarehouseTier.COUNTRY_IMPORT,
  });
  console.log('Entrepôt National créé:', countryWarehouse.id);

  const regionalWarehouse = await WarehouseModel.create({
    companyId: company.id,
    name: 'Entrepôt Régional — Littoral',
    tier: WarehouseTier.REGIONAL,
    regionId: region.id,
  });
  console.log('Entrepôt Régional créé:', regionalWarehouse.id);

  const store = await StoreModel.create({
    companyId: company.id,
    name: 'Boutique Centre-Ville',
    type: StoreType.PHYSICAL,
    regionId: region.id,
  });
  console.log('Boutique créée:', store.id);

  console.log('\nSeed terminé. Connectez-vous sur /v1/auth/login avec :');
  console.log('  email: admin@example.com');
  console.log('  password: ChangeMe123!');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Échec du seed:', err);
  process.exit(1);
});
