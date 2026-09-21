/* eslint-disable no-console */
/**
 * One-off migration: regionId used to be free text (e.g. "littoral"). It must
 * now be the id of a real Region. For every store / warehouse / user whose
 * regionId is not already a 24-hex id, this creates (or reuses) a Region with
 * that name in the record's company and points regionId at it.
 *
 *   node dist/database/backfill-regions.js
 *
 * Idempotent: records that already hold a region id are left alone.
 * Users with no company cannot have a region and are reported, not changed.
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';

const HEX24 = /^[0-9a-f]{24}$/i;
const titleCase = (v: string) => v.trim().replace(/(^|[\s_-])(\w)/g, (_, a, b) => a + b.toUpperCase());

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/multicompany_commerce';
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db!;
  const regions = db.collection('regions');
  await regions.createIndex({ companyId: 1, name: 1 }, { unique: true });

  let created = 0, updated = 0, skipped = 0;
  for (const coll of ['stores', 'warehouses', 'users']) {
    const docs = await db
      .collection(coll)
      .find({ regionId: { $type: 'string', $ne: '' } })
      .toArray();
    for (const d of docs) {
      const raw = String(d.regionId);
      if (HEX24.test(raw)) continue; // already a region id
      if (!d.companyId) {
        skipped++;
        console.log(`  skipped ${coll}/${d._id}: no company, cannot own a region ("${raw}")`);
        continue;
      }
      const companyId = String(d.companyId);
      const name = titleCase(raw);
      let region = await regions.findOne({ companyId, name });
      if (!region) {
        const now = new Date();
        const ins = await regions.insertOne({
          companyId, name, code: raw.toLowerCase(), isActive: true, createdAt: now, updatedAt: now,
        });
        region = { _id: ins.insertedId };
        created++;
      }
      await db.collection(coll).updateOne({ _id: d._id }, { $set: { regionId: String(region._id) } });
      updated++;
    }
  }
  console.log(`Regions created: ${created}, records re-pointed: ${updated}, skipped: ${skipped}.`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
