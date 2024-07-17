const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('./user');
const Version = require('./version');
const Device = require('./device');
const env = require('../environments');

const models = { User, Device };

const connectDb = async () => {
  const dbUrl = `mongodb://${env.dbHost}:${env.dbPort}/${env.dbName}`;
  mongoose.set('strictQuery', false);
  return mongoose.connect(dbUrl);
};

const runMigrations = async () => {
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

const dropDatabase = async () => {
  await mongoose.connection.db.dropDatabase();
};

module.exports = {
  connectDb,
  models,
  runMigrations,
  dropDatabase
}
