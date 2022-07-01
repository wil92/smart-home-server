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
    await new Promise(resolve => server.close(() => resolve()));
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

    wsc.close();
  });

  it('should request EXECUTE and get answer back', async () => {
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
      expect(msg.payload.messageType).toEqual('EXECUTE');
      expect(msg.payload.command.on).toBeFalsy();
      wsc.send(JSON.stringify({
        ...deviceRes,
        mid: msg.mid,
        payload: {...deviceRes.payload, on: msg.payload.command.on}
      }));
    });
    await new Promise(resolve => {
      wsc.on('open', () => {
        wsc.send(JSON.stringify(deviceRes));
        resolve();
      });
    });

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff46a3cc-ec34-11e6-b1a0-64510651abcf",
        inputs: [{
          intent: "action.devices.EXECUTE",
          payload: {
            commands: [{
              devices: [
                {id: 'CgCGzmhvelv'},
                {id: 'nofound'}
              ],
              execution: [{
                command: 'action.devices.commands.OnOff',
                params: {on: false}
              }]
            }]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff46a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.commands[0].ids[0]).toEqual('CgCGzmhvelv');
    expect(res.body.payload.commands[0].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[0].states.on).toBeFalsy();
    expect(data.lights.get('CgCGzmhvelv').on).toBeFalsy();
    expect(res.body.payload.commands[0].states.online).toBeTruthy();

    expect(res.body.payload.commands[1].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[1].status).toEqual("OFFLINE");
    expect(res.body.payload.commands[1].states.online).toBeFalsy();

    wsc.close();
  });
});
