import request from "supertest";

import {createAccessToken} from "../src/utils";
import {getApp, closeApp, createClient, closeClients, cleanDevicesInDb} from "./utils/utils";

describe('WebSocket', () => {
  let app: any;

  beforeAll(async () => {
    [app] = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  afterEach(async () => {
  });

  it('should request QUERY and get answer back', async () => {
    const deviceId1 = await createClient({
        messageType: 'QUERY',
        payload: {
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
              {id: deviceId1},
              {id: "not-found"}
            ]
          }
        }]
      })
      .expect(200);

    expect(res.body.requestId).toEqual("ff36a3cc-ec34-11e6-b1a0-64510651abcf");

    expect(res.body.payload.devices[deviceId1].status).toEqual("SUCCESS");
    expect(res.body.payload.devices[deviceId1].online).toBeTruthy();
    expect(res.body.payload.devices[deviceId1].on).toBeTruthy();

    expect(res.body.payload.devices["not-found"].status).toEqual("ERROR");
    expect(res.body.payload.devices["not-found"].online).toBeFalsy();
    expect(res.body.payload.devices["not-found"].errorCode).toEqual('Device is not available in the system');

    await closeClients([deviceId1]);
    await cleanDevicesInDb({pid: deviceId1});
  });

  it('should request EXECUTE and get answer back', async () => {
    const deviceId1 = await createClient({
        messageType: 'QUERY',
        payload: {
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
                {id: deviceId1},
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

    const index1 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === deviceId1);
    expect(res.body.payload.commands[index1].ids[0]).toEqual(deviceId1);
    expect(res.body.payload.commands[index1].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[index1].states.on).toBeFalsy();
    expect(res.body.payload.commands[index1].states.online).toBeTruthy();

    const index2 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === 'nofound');
    expect(res.body.payload.commands[index2].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[index2].status).toEqual("ERROR");
    expect(res.body.payload.commands[index2].errorCode).toEqual("Device is not available in the system");

    await closeClients([deviceId1]);
    await cleanDevicesInDb({pid: deviceId1});
  });
});
