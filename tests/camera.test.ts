import request from 'supertest';
import {WebSocket} from 'ws';
import fs from 'fs';
import path from 'path';

import {env} from '../src/environments';
import {createAccessToken} from "../src/utils";
import {getApp, closeApp, closeClients, createClient, cleanDevicesInDb} from "./utils/utils";
import {WSMessageResponse} from "../src/socket/web-socket";
import device from "../src/models/device";

jest.setTimeout(1000000);

describe('Camera integration test', () => {
  let app: any;
  const googleUserId = 'CAMERA_AGENT_USER_ID';

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

  it('should SYNC the camera device in google', async () => {
    const deviceId = await connectDevices();

    const token = createAccessToken();
    const requestIdExample = "ff36a3cc-ec34-11e6-b1a0-64510650abct";
    const res = await request(app).post('/api/devices/fulfillment')
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

    const index  = res.body.payload.devices.findIndex((d: any) => d.id === deviceId);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(res.body.payload.devices[index].type).toEqual('action.devices.types.CAMERA');
    expect(res.body.payload.devices[index].name.name).toEqual('camera01');
    expect(res.body.payload.devices[index].name._id).toBeFalsy();
    expect(res.body.payload.devices[index].willReportState).toEqual(true);
    expect(res.body.payload.devices[index].traits.length).toEqual(1);
    expect(res.body.payload.devices[index].traits[0]).toEqual('action.devices.traits.CameraStream');
    expect(res.body.payload.devices[index].attributes.cameraStreamSupportedProtocols.length).toEqual(1);
    expect(res.body.payload.devices[index].attributes.cameraStreamNeedAuthToken).toBeFalsy();
    expect(res.body.payload.devices[index].attributes.cameraStreamNeedDrmEncryption).toBeFalsy();

    await closeClients([deviceId]);
    await cleanDevicesInDb({pid: deviceId});
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
    expect(res.body.payload.devices[deviceId].isRunning).toEqual(undefined);

    expect(res.body.payload.devices['nofound'].status).toEqual("ERROR");
    expect(res.body.payload.devices['nofound'].online).toEqual(false);
    expect(res.body.payload.devices['nofound'].errorCode).toEqual('Device is not available in the system');

    await closeClients([deviceId]);
    await cleanDevicesInDb({pid: deviceId});
  });

  it('should response to the EXECUTE request', async () => {
    const onMessage = (msg: WSMessageResponse, ws: WebSocket) => {
      expect(msg.payload.messageType).toEqual('EXECUTE');
      expect(msg.payload.command).toBeTruthy();
      expect(msg.payload.command?.on).toEqual(true);

      const img = fs.readFileSync(path.join(__dirname, 'utils/diode.jpg'));
      ws.send(img);

      return msg;
    };
    const deviceId = await connectDevices(onMessage);

    const token = createAccessToken();
    const res = await request(app).post('/api/devices/fulfillment')
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
                command: 'action.devices.commands.GetCameraStream',
                params: {
                  StreamToChromecast: true,
                  SupportedStreamProtocols: ['hls']
                }
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
    expect(res.body.payload.commands[index1].states.isRunning).toEqual(undefined);
    expect(res.body.payload.commands[index1].states.online).toEqual(true);
    expect(res.body.payload.commands[index1].states.cameraStreamProtocol).toEqual('hls');
    expect(res.body.payload.commands[index1].states.cameraStreamAccessUrl).toEqual(`http://localhost/stream/hls/${deviceId}.m3u8`);

    const streamImageFile = path.join(__dirname, '../public/stream/', `${deviceId}.jpg`);
    expect(fs.existsSync(streamImageFile)).toBeTruthy();
    const streamHlsFile = path.join(__dirname, '../public/stream/', `${deviceId}.m3u8`);
    expect(fs.existsSync(streamHlsFile)).toBeTruthy();
    const streamHlsTsFile = path.join(__dirname, '../public/stream/', `${deviceId}0.ts`);
    expect(fs.existsSync(streamHlsTsFile)).toBeTruthy();

    await request(app).get(`/stream/hls/${deviceId}.m3u8`)
        .expect(200);

    // extra, not needed right now
    const index2 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === 'nofound');
    expect(res.body.payload.commands[index2].ids[0]).toEqual("nofound");
    expect(res.body.payload.commands[index2].status).toEqual("ERROR");
    expect(res.body.payload.commands[index2].errorCode).toEqual("Device is not available in the system");

    await closeClients([deviceId]);
    await cleanDevicesInDb({pid: deviceId});
  });

  async function connectDevices(onMessage = (msg: any, ws: WebSocket) => msg): Promise<string> {
    return await createClient({
      messageType: 'QUERY',
      payload: {
        type: 'action.devices.types.CAMERA',
        name: { name: 'camera01' }
      }
    }, onMessage);
  }
});
