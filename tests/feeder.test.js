const request = require('supertest');

const env = require('../src/environments')
const { createAccessToken } = require("../src/utils");
const { getApp, closeApp, closeClients, createClient, closeClient, cleanDevicesInDb } = require("./utils/utils");

jest.setTimeout(1000000);

describe('Functions test', () => {
  let app;
  const googleUserId = 'AGENT_USER_ID';

  beforeAll(async () => {
    env.username = 'test';
    env.password = 'test';
    env.auth2ClientId = 'GOOGLE_CLIENT_ID';
    env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
    env.auth2redirectUri = 'REDIRECT_URI';
    env.googleUserId = googleUserId;

    [app] = await getApp();
    await cleanDevicesInDb();
  });

  afterAll(async () => {
    await closeApp();
  });

  afterEach(async () => {
    await closeClients();
  });

  it('should SYNC the items with google actions', async () => {
    await connectDevices();

    const token = createAccessToken();
    const requestIdExample = "ff36a3cc-ec34-11e6-b1a0-64510650abcf";
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: requestIdExample,
        inputs: [{ intent: "action.devices.SYNC" }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual(requestIdExample);
    expect(res.body.payload).toBeTruthy();
    expect(res.body.payload.agentUserId).toEqual(googleUserId);
    expect(res.body.payload.devices.length).toEqual(1);

    // device 0 {type: 'PETFEEDER', name: 'td3', id: 'CgCGzmhvel3'}
    expect(res.body.payload.devices[0].id).toEqual('CgCGzmhvel3');
    expect(res.body.payload.devices[0].type).toEqual('action.devices.types.PETFEEDER');
    expect(res.body.payload.devices[0].name.name).toEqual('td3');
    expect(res.body.payload.devices[0].name._id).toBeFalsy();
    expect(res.body.payload.devices[0].willReportState).toEqual(false);
    expect(res.body.payload.devices[0].attributes.pausable).toEqual(false);
    expect(res.body.payload.devices[0].traits.length).toEqual(1);
    expect(res.body.payload.devices[0].traits[0]).toEqual('action.devices.traits.StartStop');
  });

  it('should response to the QUERY request', async () => {
    await connectDevices();

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff36a3cc-ec34-11e6-b1a0-64510651abcf",
        inputs: [{
          intent: "action.devices.QUERY",
          payload: {
            devices: [
              { id: 'CgCGzmhvel3' },
              { id: 'nofound' }
            ]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.devices['CgCGzmhvel3'].status).toEqual("SUCCESS");
    expect(res.body.payload.devices['CgCGzmhvel3'].online).toEqual(true);
    expect(res.body.payload.devices['CgCGzmhvel3'].isRunning).toEqual(true);

    expect(res.body.payload.devices['nofound'].status).toEqual("ERROR");
    expect(res.body.payload.devices['nofound'].online).toEqual(false);
    expect(res.body.payload.devices['nofound'].errorCode).toEqual('Device is not available in the system');
  });

  it('should response to the EXECUTE request', async () => {
    const onMessage = (msg) => {
      expect(msg.payload.messageType).toEqual('EXECUTE');
      expect(msg.payload.command).toBeTruthy();
      expect(msg.payload.command.start).toEqual(true);
      return msg;
    };
    await connectDevices(onMessage);

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
                { id: 'CgCGzmhvel3' },
                { id: 'nofound' }
              ],
              execution: [{
                command: 'action.devices.commands.StartStop',
                params: { start: true }
              }]
            }]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff46a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.commands[0].ids[0]).toEqual('CgCGzmhvel3');
    expect(res.body.payload.commands[0].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[0].states.isRunning).toEqual(true);
    expect(res.body.payload.commands[0].states.online).toEqual(true);

    expect(res.body.payload.commands[1].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[1].status).toEqual("ERROR");
    expect(res.body.payload.commands[1].errorCode).toEqual("Device is not available in the system");
  });

  async function connectDevices(onMessage = (msg) => msg) {
    await createClient({
      messageType: 'QUERY',
      payload: {
        id: 'CgCGzmhvel3',
        isRunning: true,
        type: 'action.devices.types.PETFEEDER',
        name: { name: 'td3' }
      }
    }, onMessage);
  }
});
