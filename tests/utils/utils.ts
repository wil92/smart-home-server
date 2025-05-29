import http from "http";
import mongoose from "mongoose";
import WebSocket from "ws";
import {filter} from "rxjs";

import {env} from "../../src/environments";
import {connectDb, dropDatabase, runMigrations, models} from "../../src/models";
import wepSocketInstance from "../../src/socket/web-socket";

import app from "../../app";

let testPort: number;
let server: any;
let clients: any[] = [];

function randomText(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

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
    // await dropDatabase();
    await mongoose.connection.close();
    await wepSocketInstance.stop();
    await new Promise(resolve => server.close(resolve));
  } catch (e) {
    console.error(e);
  }
}

export async function cleanDevicesInDb(query: any) {
  await new Promise((resolve, reject) => {
    models.Device.deleteMany(query, (err: any) => err ? reject(err) : resolve({}));
  });
}

export async function createClient(deviceRes: any, onMessage = (msg: any, ws: WebSocket.WebSocket) => msg, websocketPort = testPort): Promise<string> {
  deviceRes = {
    mid: '',
    messageType: 'QUERY',
    ...deviceRes,
    payload: {
      on: true,
      type: 'action.devices.types.OUTLET',
      name: {name: 'td1'},
      ...(deviceRes.payload || {}),
      id: randomText(11),
    }
  };
  const wsc: any = new WebSocket.WebSocket(`ws://localhost:${websocketPort}`);
  wsc.on('message', (data: any) => {
    let msg = JSON.parse(data);
    msg = onMessage(msg, wsc);
    deviceRes = {...deviceRes, payload: {...deviceRes.payload, ...msg.payload.command}};
    wsc.send(JSON.stringify({...deviceRes, mid: msg.mid}));
  });
  wsc.on('open', () => {
    wsc.send(JSON.stringify(deviceRes));
  });
  await new Promise(resolve => wepSocketInstance.incomeMessages
    .pipe(filter((m: any) => m.payload.id === deviceRes.payload.id))
    .subscribe(() => resolve({})));
  wsc.did = deviceRes.payload.id;
  clients.push(wsc);

  return deviceRes.payload.id;
}

export async function closeClients(ids: string[]) {
  for (const id of ids) {
    const index = clients.findIndex(c => c.did === id);

    if (index !== -1) {
      await clients[index].close();
      clients.splice(index, 1);
    }
  }
}

export async function closeClient(id: string) {
  for (const c of clients) {
    if (c.did === id) {
      await c.close();
    }
  }
  clients = clients.filter(c => c.did !== id);
}
