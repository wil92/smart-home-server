import mongoose, { Connection } from 'mongoose';

import User from './user';
import Version from './version';
import Device from './device';
import { env } from '../environments';
import migrations from './migrations';

export const models = { User, Device };

export function dbStatus(): boolean {
  return (
    (mongoose?.connections ?? []).reduce(
      (acc: boolean, value: Connection): boolean => acc && value.readyState === 1,
      true
    ) && mongoose?.connections?.length > 0
  );
}

export const connectDb = async () => {
  const dbUrl = `mongodb://${env.dbHost}:${env.dbPort}/${env.dbName}`;
  mongoose.set('strictQuery', false);
  return mongoose.connect(dbUrl);
};

export const runMigrations = async () => {
  for (const migration of migrations) {
    const exist = await Version.versionExist(migration.version);
    if (!exist) {
      try {
        await migration.migrate(models, env);
        const newVersion = new Version({
          version: migration.version,
          description: migration.description
        });
        await newVersion.save();
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
  }
};

export const dropDatabase = async () => {
  await mongoose.connection.db.dropDatabase();
};
