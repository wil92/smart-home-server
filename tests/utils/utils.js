const http = require("http");
const mongoose = require("mongoose");
const WebSocket = require("ws");
const {filter} = require("rxjs");

const env = require("../../src/environments");
const {connectDb, dropDatabase, runMigrations, models} = require("../../src/models");
const ws = require("../../src/socket/web-socket");

let testPort;
let server;
let clients = [];

async function getApp() {
  env.dbName = 'testdb';
  await connectDb();
  await runMigrations();
  const app = require('../../app');
  server = http.createServer(app);
  ws.startWebSocket(server);
  await server.listen(0);
  testPort = server.address().port;
  console.log('PORT:', testPort);
  return [app, server];
}

async function closeApp() {
  try {
    await dropDatabase();
    await mongoose.connection.close();
    await ws.stop();
    await new Promise(resolve => server.close(resolve));
  } catch (e) {
    console.error(e);
  }
}

async function cleanDevicesInDb() {
  await new Promise((resolve, reject) => {
    models.Device.deleteMany({}, (err) => err ? reject(err) : resolve());
  });
}

async function createClient(deviceRes, onMessage = (msg) => msg) {
  deviceRes = {
    mid: '',
    messageType: 'QUERY',
    payload: {
      id: 'CgCGzmhvelv',
      on: true,
      type: 'action.devices.types.OUTLET',
      name: {name: 'td1'}
    },
    ...deviceRes
  };
  const wsc = new WebSocket.WebSocket(`ws://localhost:${testPort}`);
  wsc.on('message', (data) => {
    let msg = JSON.parse(data);
    msg = onMessage(msg);
    deviceRes = {...deviceRes, payload: {...deviceRes.payload, ...msg.payload.command}};
    wsc.send(JSON.stringify({...deviceRes, mid: msg.mid}));
  });
  wsc.on('open', () => {
    console.log('sent initial status')
    wsc.send(JSON.stringify(deviceRes));
  });
  await new Promise(resolve => ws.incomeMessages
    .pipe(filter(m => m.payload.id === deviceRes.payload.id))
    .subscribe(() => resolve()));
  wsc.did = deviceRes.payload.id;
  clients.push(wsc);
  return wsc;
}

async function closeClients() {
  for (const c of clients) {
    await c.close();
  }
  clients = [];
}

async function closeClient(id) {
  for (const c of clients) {
    if (c.did === id) {
      await c.close();
    }
  }
  clients = clients.filter(c => c.did !== id);
}

module.exports = {getApp, closeApp, createClient, closeClients, closeClient, cleanDevicesInDevice: cleanDevicesInDb};
