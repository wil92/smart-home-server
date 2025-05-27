import request from 'supertest';

import env from '../src/environments';
import {createAccessToken} from "../src/utils";
import {getApp, closeApp, closeClients, createClient, cleanDevicesInDb} from "./utils/utils";

jest.setTimeout(1000000);

describe('Functions test', () => {
  let app: any;
  const googleUserId = 'AGENT_USER_ID';

  beforeAll(async () => {
    env.username = 'test';
    env.password = 'test';
    env.auth2ClientId = 'GOOGLE_CLIENT_ID';
    env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
    env.auth2redirectUri = 'REDIRECT_URI';
    env.googleUserId = googleUserId;

    [app] = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  afterEach(async () => {
  });

  it('should SYNC the items with google actions', async () => {
    const deviceId = await connectDevices();

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
    expect(res.body.payload.devices.length).toBeGreaterThan(0);

    // device 0 {type: 'PETFEEDER', name: 'td3', id: deviceId}
    const index = res.body.payload.devices.findIndex((d: any) => d.id === deviceId);
    expect(res.body.payload.devices[index].id).toEqual(deviceId);
    expect(res.body.payload.devices[index].type).toEqual('action.devices.types.PETFEEDER');
    expect(res.body.payload.devices[index].name.name).toEqual('td3');
    expect(res.body.payload.devices[index].name._id).toBeFalsy();
    expect(res.body.payload.devices[index].willReportState).toEqual(false);
    expect(res.body.payload.devices[index].attributes.pausable).toEqual(false);
    expect(res.body.payload.devices[index].traits.length).toEqual(1);
    expect(res.body.payload.devices[index].traits[0]).toEqual('action.devices.traits.StartStop');

    await closeClients([deviceId]);
    await cleanDevicesInDb({ pid: deviceId });
  });

  it('should response to the QUERY request', async () => {
    const deviceId = await connectDevices();

    const token = createAccessToken();
    const res = await request(app).post('/api/lights/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: "ff36a3cc-ec34-11e6-b1a0-64510651abcf",
        inputs: [{
          intent: "action.devices.QUERY",
          payload: {
            devices: [
              { id: deviceId },
              { id: 'nofound' }
            ]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.devices[deviceId].status).toEqual("SUCCESS");
    expect(res.body.payload.devices[deviceId].online).toEqual(true);
    expect(res.body.payload.devices[deviceId].isRunning).toEqual(true);

    expect(res.body.payload.devices['nofound'].status).toEqual("ERROR");
    expect(res.body.payload.devices['nofound'].online).toEqual(false);
    expect(res.body.payload.devices['nofound'].errorCode).toEqual('Device is not available in the system');

    await closeClients([deviceId]);
    await cleanDevicesInDb({ pid: deviceId });
  });

  it('should response to the EXECUTE request', async () => {
    const onMessage = (msg: any) => {
      expect(msg.payload.messageType).toEqual('EXECUTE');
      expect(msg.payload.command).toBeTruthy();
      expect(msg.payload.command.start).toEqual(true);
      return msg;
    };
    const deviceId = await connectDevices(onMessage);

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
                { id: deviceId },
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

    const index1 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === deviceId);
    expect(res.body.payload.commands[index1].ids[0]).toEqual(deviceId);
    expect(res.body.payload.commands[index1].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[index1].states.isRunning).toEqual(true);
    expect(res.body.payload.commands[index1].states.online).toEqual(true);

    const index2 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === 'nofound');
    expect(res.body.payload.commands[index2].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[index2].status).toEqual("ERROR");
    expect(res.body.payload.commands[index2].errorCode).toEqual("Device is not available in the system");

    await closeClients([deviceId]);
    await cleanDevicesInDb({ pid: deviceId });
  });

  async function connectDevices(onMessage = (msg: any) => msg) {
    return await createClient({
      messageType: 'QUERY',
      payload: {
        isRunning: true,
        type: 'action.devices.types.PETFEEDER',
        name: { name: 'td3' }
      }
    }, onMessage);
  }
});
