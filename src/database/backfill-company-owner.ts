/* eslint-disable no-console */
/**
 * One-off migration for databases created before Company.createdBy existed:
 * links every company that has no owner to a super admin.
 *
 *   node dist/database/backfill-company-owner.js [super-admin-email]
 *
 * With no argument it only proceeds if there is exactly one super admin.
 * Safe to re-run: companies that already have an owner are left alone.
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/multicompany_commerce';
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db!;
  const users = db.collection('users');
  const companies = db.collection('companies');

  const email = process.argv[2]?.toLowerCase();
  const owners = await users
    .find(email ? { role: 'super_admin', email } : { role: 'super_admin' })
    .toArray();
  if (owners.length !== 1) {
    console.error(
      owners.length === 0
        ? 'No matching super admin found.'
        : `Found ${owners.length} super admins — pass the owner's email as an argument.`,
    );
    process.exitCode = 1;
    return;
  }

  const res = await companies.updateMany(
    { createdBy: { $exists: false } },
    { $set: { createdBy: owners[0]._id } },
  );
  console.log(`Linked ${res.modifiedCount} company(ies) to ${owners[0].email}.`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
