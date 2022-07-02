const http = require("http");
const mongoose = require("mongoose");

const env = require("../../src/environments");
const {connectDb, dropDatabase, runMigrations} = require("../../src/models");
const ws = require("../../src/socket/web-socket");

const testPort = process.env.TEST_PORT || 3023;

let a;

async function getApp() {
  env.dbName = 'testdb';
  await connectDb();
  await runMigrations();
  const app = require('../../app');
  const server = http.createServer(app);
  ws.startWebSocket(server);
  a = await server.listen(testPort);
  return [app, server];
}

async function closeApp(app, server) {
  await dropDatabase();
  await mongoose.connection.close();
  app && await app.close();
  server && await server.close();
  a && await a.close();
  await ws.stop();
}

module.exports = {getApp, closeApp};
