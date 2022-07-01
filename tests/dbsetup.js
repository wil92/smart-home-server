const env = require("../src/environments");
const {connectDb, dropDatabase, runMigrations} = require("../src/models");

async function getApp() {
  env.dbName = 'testdb';
  await connectDb();
  await runMigrations();
  return require('../app');
}

async function closeApp() {
  await dropDatabase();
}

module.exports = {getApp, closeApp};
