const request = require('supertest');

const env = require('../src/environments')
const {createAccessToken, createRefreshToken} = require("../src/utils");
const {getApp, closeApp, closeClients, createClient, closeClient} = require("./utils/utils");

jest.setTimeout(1000000);

describe('Functions test', () => {
  let app;

  beforeAll(async () => {
    env.username = 'test';
    env.password = 'test';
    env.auth2ClientId = 'GOOGLE_CLIENT_ID';
    env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
    env.auth2redirectUri = 'REDIRECT_URI';
    env.googleUserId = 'AGENT_USER_ID';

    [app] = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  afterEach(async () => {
    await closeClients();
  });

  it('should get 401 if the request did not have and access_token', async () => {
    await request(app).post('/api/lights')
      .expect(401);
  });

  it('should get 401 if the access_token is invalid', async () => {
    await request(app).post('/api/lights')
      .set('Authorization', 'Bearer invalid_access_token')
      .expect(401);
  });

  it('should get 401 if is use a token different to the access_token', async () => {
    const token = createRefreshToken();
    await request(app).post('/api/lights')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('should get the list of lights if the token is correct', async () => {
    const token = createAccessToken();
    const res = await request(app).get('/api/lights')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toEqual(0);
  });

  it('should SYNC the items with google actions', async () => {
    await connectDevices();

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
        inputs: [{intent: "action.devices.SYNC"}]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510650abcf");
    expect(res.body.payload.agentUserId).toEqual("AGENT_USER_ID");
    expect(res.body.payload.devices.length).toEqual(2);

    // device 0 {type: 'OUTLET', name: 'td1', id: 'CgCGzmhvelv'}
    expect(res.body.payload.devices[0].id).toEqual('CgCGzmhvelv');
    expect(res.body.payload.devices[0].type).toEqual('action.devices.types.OUTLET');
    expect(res.body.payload.devices[0].name.name).toEqual('td1');
    expect(res.body.payload.devices[0].willReportState).toBeFalsy();
    expect(res.body.payload.devices[0].traits.length).toEqual(1);
    expect(res.body.payload.devices[0].traits[0]).toEqual('action.devices.traits.OnOff');

    // device 1 {type: 'OUTLET', name: 'td2', id: 'CgCGzmhvel2'}
    expect(res.body.payload.devices[1].id).toEqual('CgCGzmhvel2');
    expect(res.body.payload.devices[1].type).toEqual('action.devices.types.OUTLET');
    expect(res.body.payload.devices[1].name.name).toEqual('td2');
    expect(res.body.payload.devices[1].willReportState).toBeFalsy();
    expect(res.body.payload.devices[1].traits.length).toEqual(1);
    expect(res.body.payload.devices[1].traits[0]).toEqual('action.devices.traits.OnOff');
  });

  it('should response to the QUERY request', async () => {
    await connectDevices();
    await closeClient('CgCGzmhvel2');

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
              {id: 'CgCGzmhvel2'},
              {id: 'nofound'}
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

    expect(res.body.payload.devices['nofound'].status).toEqual("ERROR");
    expect(res.body.payload.devices['nofound'].online).toBeFalsy();
    expect(res.body.payload.devices['nofound'].errorCode).toEqual('Device is available in the system');
  });

  it('should response to the EXECUTE request', async () => {
    await connectDevices();
    await closeClient('CgCGzmhvel2');

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
            }, {
              devices: [
                {id: 'CgCGzmhvel2'}
              ],
              execution: [{
                command: 'action.devices.commands.OnOff',
                params: {on: true}
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

    expect(res.body.payload.commands[1].ids[0]).toEqual("CgCGzmhvel2");
    expect(res.body.payload.commands[1].status).toEqual('OFFLINE');
    expect(res.body.payload.commands[1].states.online).toBeFalsy();

    expect(res.body.payload.commands[2].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[2].status).toEqual("ERROR");
    expect(res.body.payload.commands[2].errorCode).toEqual("Device is available in the system");
  });

  async function connectDevices() {
    await createClient({
      messageType: 'QUERY',
      payload: {
        id: 'CgCGzmhvelv',
        on: true,
        type: 'action.devices.types.OUTLET',
        name: {name: 'td1'}
      }
    });
    await createClient({
      messageType: 'QUERY',
      payload: {
        id: 'CgCGzmhvel2',
        on: false,
        type: 'action.devices.types.OUTLET',
        name: {name: 'td2'}
      }
    });
  }
});
