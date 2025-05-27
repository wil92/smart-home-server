import http from "http";
import mongoose from "mongoose";
import WebSocket from "ws";
import {filter} from "rxjs";

import env from "../../src/environments";
import {connectDb, dropDatabase, runMigrations, models} from "../../src/models";
import wepSocketInstance from "../../src/socket/web-socket";

import app from "../../app";

let testPort: number;
let server: any;
let clients: any[] = [];

export async function getApp() {
  env.dbName = 'testdb';
  await connectDb();
  await runMigrations();
  server = http.createServer(app);
  wepSocketInstance.startWebSocket(server);
  await server.listen(0);
  testPort = server.address().port;
  console.log('PORT:', testPort);
  return [app, server];
}

export async function closeApp() {
  try {
    await dropDatabase();
    await mongoose.connection.close();
    await wepSocketInstance.stop();
    await new Promise(resolve => server.close(resolve));
  } catch (e) {
    console.error(e);
  }
}

export async function cleanDevicesInDb() {
  await new Promise((resolve, reject) => {
    models.Device.deleteMany({}, (err) => err ? reject(err) : resolve({}));
  });
}

export async function createClient(deviceRes: any, onMessage = (msg: any) => msg, websocketPort = testPort) {
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
  const wsc: any = new WebSocket.WebSocket(`ws://localhost:${websocketPort}`);
  wsc.on('message', (data: any) => {
    let msg = JSON.parse(data);
    msg = onMessage(msg);
    deviceRes = {...deviceRes, payload: {...deviceRes.payload, ...msg.payload.command}};
    wsc.send(JSON.stringify({...deviceRes, mid: msg.mid}));
  });
  wsc.on('open', () => {
    console.log('sent initial status')
    wsc.send(JSON.stringify(deviceRes));
  });
  await new Promise(resolve => wepSocketInstance.incomeMessages
    .pipe(filter((m: any) => m.payload.id === deviceRes.payload.id))
    .subscribe(() => resolve({})));
  wsc.did = deviceRes.payload.id;
  clients.push(wsc);
  return wsc;
}

export async function closeClients() {
  for (const c of clients) {
    await c.close();
  }
  clients = [];
}

export async function closeClient(id: string) {
  for (const c of clients) {
    if (c.did === id) {
      await c.close();
    }
  }
  clients = clients.filter(c => c.did !== id);
}
