const WebSocket = require("ws");
const {filter} = require("rxjs");

const ws = require('../../src/socket/web-socket')

const testPort = process.env.TEST_PORT || 3023;

let clients = [];

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
  clients.push(wsc);
  return wsc;
}

async function closeClient() {
  for (const c of clients) {
    await c.close();
  }
  clients = [];
}

module.exports = {createClient, closeClient};
