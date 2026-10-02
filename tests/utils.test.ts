import jwt from 'jsonwebtoken';

import { env } from '../src/environments';
import { models } from '../src/models';
import { randomText, createAccessToken, ACCESS_TOKEN_TYPE } from '../src/utils';
import { getApp, closeApp, createClient, closeClients, cleanDevicesInDb } from './utils/utils';

describe('Utils functions', () => {
  let server: any;
  const devices: string[] = [];

  beforeAll(async () => {
    [, server] = await getApp();
  });

  afterEach(async () => {
    await closeClients(devices);
    for (const did of devices) {
      await cleanDevicesInDb({ did });
    }
    devices.length = 0;
  });

  afterAll(async () => {
    await closeApp(server);
  });

  it('should expect a random text of size 10', () => {
    expect(randomText(10).length).toEqual(10);
    expect(randomText(20).length).toEqual(20);
  });

  it('should get accessToken', function () {
    const token = createAccessToken();
    const payload = jwt.verify(token, env.key) as jwt.JwtPayload;
    expect(payload.type).toEqual(ACCESS_TOKEN_TYPE);
    expect(payload.exp! - payload.iat!).toEqual(2 * 60 * 60);
    expect(() => jwt.verify(token, 'wrong-key')).toThrow();
  });

  it('should connect testing device to server', async () => {
    const deviceId = await createClient({
      messageType: 'QUERY',
      payload: {
        on: true,
        type: 'action.devices.types.OUTLET',
        name: { name: 'td1' }
      }
    });
    devices.push(deviceId);

    expect(env.wsAuthToken).toBeDefined();
    const device = await models.Device.findOne({ did: deviceId });
    expect(device).not.toBeNull();
    expect(device?.type).toEqual('action.devices.types.OUTLET');
    expect(device?.name.name).toEqual('td1');
    expect(device?.params.on).toBe(true);
  });
});
