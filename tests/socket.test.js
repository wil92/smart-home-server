const WebSocket = require('ws');
const ws = require("../src/socket/web-socket");
const http = require("http");
const {createAccessToken} = require("../src/utils");
const data = require('../src/data');
const request = require("supertest");

const testPort = process.env.TEST_PORT || 3023;

describe('WebSocket', () => {
  let app, server;

  beforeAll(async () => {
    app = require('../app');
    server = http.createServer(app);
    ws.startWebSocket(server);
    return new Promise(resolve => server.listen(testPort, () => resolve()));
  });

  afterAll(async () => {
    await server.close();
  });

  it('should request QUERY and get answer back', async () => {
    data.lights.clear();
    const deviceRes = {
      mid: '',
      messageType: 'QUERY',
      payload: {
        id: 'CgCGzmhvelv',
        on: true,
        type: 'action.devices.types.OUTLET',
        name: {name: 'td1'}
      }
    };
    const wsc = new WebSocket.WebSocket(`ws://localhost:${testPort}`);
    wsc.on('message', (data) => {
      const msg = JSON.parse(data);
      expect(msg.payload.messageType).toEqual('QUERY');
      wsc.send(JSON.stringify({...deviceRes, mid: msg.mid}));
    });
    await new Promise(resolve => {
      wsc.on('open', () => {
        // toDo 24.06.22, guille, initial connection
        wsc.send(JSON.stringify(deviceRes));
        resolve();
      });
    });

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff36a3cc-ec34-11e6-b1a0-64510651abcf",
        inputs: [{
          intent: "action.devices.QUERY",
          payload: {
            devices: [
              {id: 'CgCGzmhvelv'},
              {id: 'CgCGzmhvel2'}
            ]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.devices['CgCGzmhvelv'].status).toEqual("SUCCESS");
    expect(res.body.payload.devices['CgCGzmhvelv'].online).toBeTruthy();
    expect(res.body.payload.devices['CgCGzmhvelv'].on).toBeTruthy();

    expect(res.body.payload.devices['CgCGzmhvel2'].status).toEqual("OFFLINE");
    expect(res.body.payload.devices['CgCGzmhvel2'].online).toBeFalsy();
  });
});
