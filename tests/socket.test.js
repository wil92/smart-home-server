const request = require("supertest");

const {createAccessToken} = require("../src/utils");
const {getApp, closeApp, createClient, closeClient} = require("./utils/utils");

describe('WebSocket', () => {
  let app;

  beforeAll(async () => {
    [app] = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  afterEach(async () => {
    await closeClient();
  });

  it('should request QUERY and get answer back', async () => {
    await createClient({
        messageType: 'QUERY',
        payload: {
          id: 'CgCGzmhvelv',
          on: true,
          type: 'action.devices.types.OUTLET',
          name: {name: 'td1'}
        }
      },
      (msg) => {
        expect(msg.payload.messageType).toEqual('QUERY');
        return msg;
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

  it('should request EXECUTE and get answer back', async () => {
    await createClient({
        messageType: 'QUERY',
        payload: {
          id: 'CgCGzmhvelv',
          on: true,
          type: 'action.devices.types.OUTLET',
          name: {name: 'td1'}
        }
      },
      (msg) => {
        expect(msg.payload.messageType).toEqual('EXECUTE');
        expect(msg.payload.command.on).toBeFalsy();
        return msg;
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
    expect(res.body.payload.commands[0].states.online).toBeTruthy();

    expect(res.body.payload.commands[1].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[1].status).toEqual("OFFLINE");
    expect(res.body.payload.commands[1].states.online).toBeFalsy();
  });
});
