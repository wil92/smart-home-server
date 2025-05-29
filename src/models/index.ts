import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

import User from './user';
import Version from './version';
import Device from './device';
import {env} from '../environments';

export const models = { User, Device };

export const connectDb = async () => {
  const dbUrl = `mongodb://${env.dbHost}:${env.dbPort}/${env.dbName}`;
  mongoose.set('strictQuery', false);
  return mongoose.connect(dbUrl);
};

export const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationsDir);
  migrations.sort();
  for (const m of migrations) {
    const migration = require(path.join(migrationsDir, m));
    const exist = await Version.versionExist(migration.version);
    if (!exist) {
      try {
        await migration.migrate(models, env);
        const newVersion = new Version({version: migration.version, description: migration.description});
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
