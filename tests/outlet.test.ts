import request from 'supertest';

import {env} from '../src/environments';
import {createAccessToken, createRefreshToken} from "../src/utils";
import {getApp, closeApp, closeClients, createClient, closeClient, cleanDevicesInDb} from "./utils/utils";

jest.setTimeout(1000000);

describe('Functions test', () => {
  let app: any;

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
    expect(res.body instanceof Array).toBeTruthy();
  });

  it('should SYNC the items with google actions', async () => {
    const [deviceId1, deviceId2] = await connectDevices();

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff36a3cc-ec34-11e6-b1a0-64510",
        inputs: [{intent: "action.devices.SYNC"}]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510");
    expect(res.body.payload.agentUserId).toEqual("AGENT_USER_ID");
    expect(res.body.payload.devices.length).toBeGreaterThan(0);

    // device 0 {type: 'OUTLET', name: 'td1', id: deviceId1}
    const device1 = res.body.payload.devices.findIndex((d: any) => d.id === deviceId1);
    expect(device1).toBeGreaterThanOrEqual(0);
    expect(res.body.payload.devices[device1].type).toEqual('action.devices.types.OUTLET');
    expect(res.body.payload.devices[device1].name.name).toEqual('td1');
    expect(res.body.payload.devices[device1].name._id).toBeFalsy();
    expect(res.body.payload.devices[device1].willReportState).toBeFalsy();
    expect(res.body.payload.devices[device1].traits.length).toEqual(1);
    expect(res.body.payload.devices[device1].traits[0]).toEqual('action.devices.traits.OnOff');

    // device 1 {type: 'OUTLET', name: 'td2', id: deviceId2}
    const device2 = res.body.payload.devices.findIndex((d: any) => d.id === deviceId2);
    expect(device2).toBeGreaterThanOrEqual(0);
    expect(res.body.payload.devices[device2].type).toEqual('action.devices.types.OUTLET');
    expect(res.body.payload.devices[device2].name.name).toEqual('td2');
    expect(res.body.payload.devices[device2].willReportState).toBeFalsy();
    expect(res.body.payload.devices[device2].traits.length).toEqual(1);
    expect(res.body.payload.devices[device2].traits[0]).toEqual('action.devices.traits.OnOff');

    await closeClients([deviceId1, deviceId2]);
    await cleanDevicesInDb({pid: deviceId1});
    await cleanDevicesInDb({pid: deviceId2});
  });

  it('should response to the QUERY request', async () => {
    const [deviceId1, deviceId2] = await connectDevices();
    await closeClients([deviceId2]);

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff36a3cc-ec34-11e6-b1a0-64510651abcf",
        inputs: [{
          intent: "action.devices.QUERY",
          payload: {
            devices: [
              {id: deviceId1},
              {id: deviceId2},
              {id: 'nofound'}
            ]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.devices[deviceId1].status).toEqual("SUCCESS");
    expect(res.body.payload.devices[deviceId1].online).toBeTruthy();
    expect(res.body.payload.devices[deviceId1].on).toBeTruthy();

    expect(res.body.payload.devices[deviceId2].status).toEqual("OFFLINE");
    expect(res.body.payload.devices[deviceId2].online).toBeFalsy();

    expect(res.body.payload.devices['nofound'].status).toEqual("ERROR");
    expect(res.body.payload.devices['nofound'].online).toBeFalsy();
    expect(res.body.payload.devices['nofound'].errorCode).toEqual('Device is not available in the system');

    await closeClients([deviceId1]);
    await cleanDevicesInDb({pid: deviceId1});
    await cleanDevicesInDb({pid: deviceId2});
  });

  it('should response to the EXECUTE request', async () => {
    const [deviceId1, deviceId2] = await connectDevices();
    await closeClients([deviceId2]);

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
                {id: deviceId1},
                {id: 'nofound'}
              ],
              execution: [{
                command: 'action.devices.commands.OnOff',
                params: {on: false}
              }]
            }, {
              devices: [
                {id: deviceId2}
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

    const index1 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === deviceId1);
    expect(res.body.payload.commands[index1].ids[0]).toEqual(deviceId1);
    expect(res.body.payload.commands[index1].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[index1].states.on).toBeFalsy();
    expect(res.body.payload.commands[index1].states.online).toBeTruthy();

    const index2 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === deviceId2);
    expect(res.body.payload.commands[index2].ids[0]).toEqual(deviceId2);
    expect(res.body.payload.commands[index2].status).toEqual('OFFLINE');
    expect(res.body.payload.commands[index2].states.online).toBeFalsy();

    const index3 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === 'nofound');
    expect(res.body.payload.commands[index3].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[index3].status).toEqual("ERROR");
    expect(res.body.payload.commands[index3].errorCode).toEqual("Device is not available in the system");

    await closeClients([deviceId1]);
    await cleanDevicesInDb({pid: deviceId1});
    await cleanDevicesInDb({pid: deviceId2});
  });

  async function connectDevices() {
    return [await createClient({
      messageType: 'QUERY',
      payload: {
        on: true,
        type: 'action.devices.types.OUTLET',
        name: {name: 'td1'}
      }
    }),
    await createClient({
      messageType: 'QUERY',
      payload: {
        on: false,
        type: 'action.devices.types.OUTLET',
        name: {name: 'td2'}
      }
    })
    ]
  }
});
