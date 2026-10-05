import request from 'supertest';

import { env } from '../src/environments';
import { createAccessToken } from '../src/utils';
import { getApp, closeApp, closeClients, createClient, cleanDevicesInDb } from './utils/utils';
import FulfillmentResponse from '../src/routes/api/models/fulfillment-response';
import { SupportedDispenseItem } from '../src/routes/api/models/device';
import Device from '../src/routes/api/models/device';

jest.setTimeout(1000000);

describe('Functions test', () => {
  let app: any, server: any;
  const googleUserId = 'AGENT_USER_ID';
  let devices: string[] = [];

  beforeAll(async () => {
    env.username = 'test';
    env.password = 'test';
    env.auth2ClientId = 'GOOGLE_CLIENT_ID';
    env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
    env.auth2redirectUri = 'REDIRECT_URI';
    env.googleUserId = googleUserId;

    [app, server] = await getApp();
  });

  afterAll(async () => {
    await closeApp(server);
  });

  afterEach(async () => {
    await closeClients(devices);
    for (const deviceId of devices) {
      await cleanDevicesInDb({ pid: deviceId });
    }
    devices = [];
  });

  it('should SYNC the items with google actions', async () => {
    const deviceId = await connectDevices();

    const token = createAccessToken();
    const requestIdExample = 'ff36a3cc-ec34-11e6-b1a0-64510650abcf';
    const res = await request(app)
      .post('/api/devices/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: requestIdExample,
        inputs: [{ intent: 'action.devices.SYNC' }]
      })
      .expect(200);

    const body: FulfillmentResponse = res.body;
    expect(body.requestId).toEqual(requestIdExample);
    expect(body.payload).toBeTruthy();
    expect(body.payload.agentUserId).toEqual(googleUserId);
    expect(body.payload.devices?.length).toBeGreaterThan(0);

    // device 0 {type: 'PETFEEDER', name: 'td3', id: deviceId}
    const index = res.body.payload.devices.findIndex((d: any) => d.id === deviceId);
    expect((body.payload.devices as Device[])[index].id).toEqual(deviceId);
    expect((body.payload.devices as Device[])[index].type).toEqual(
      'action.devices.types.PETFEEDER'
    );
    expect((body.payload.devices as Device[])[index].name.name).toEqual('td3');
    expect((body.payload.devices as Device[])[index].willReportState).toEqual(false);

    // trait values
    expect((body.payload.devices as Device[])[index].traits.length).toEqual(2);
    expect((body.payload.devices as Device[])[index].traits[0]).toEqual(
      'action.devices.traits.Dispense'
    );
    expect((body.payload.devices as Device[])[index].traits[1]).toEqual(
      'action.devices.traits.StartStop'
    );
    expect((body.payload.devices as Device[])[index].attributes?.pausable).toEqual(false);
    expect(
      (body.payload.devices as Device[])[index].attributes?.supportedDispenseItems.length
    ).toEqual(1);
    expect((body.payload.devices as Device[])[index].attributes?.supportedDispenseItems[0]).toEqual(
      {
        item_name: 'aquarium-fish-food',
        item_name_synonyms: [
          { lang: 'es', synonyms: ['Alimento para peces de acuario'] },
          { lang: 'en', synonyms: ['Aquarium Fish Food'] }
        ],
        supported_units: ['PORTION'],
        default_portion: { amount: 1, unit: 'PORTION' }
      } as SupportedDispenseItem
    );
    expect(
      (body.payload.devices as Device[])[index].attributes?.supportedDispensePresets.length
    ).toEqual(1);
    expect(
      (body.payload.devices as Device[])[index].attributes?.supportedDispensePresets[0]
    ).toEqual({
      preset_name: 'dispense-portion',
      preset_name_synonyms: [
        { lang: 'es', synonyms: ['Dispensar una porción'] },
        { lang: 'en', synonyms: ['Dispense a portion'] }
      ]
    });

    devices.push(deviceId);
  });

  it('should response to the QUERY request', async () => {
    const deviceId = await connectDevices();

    const token = createAccessToken();
    const res = await request(app)
      .post('/api/devices/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: 'ff36a3cc-ec34-11e6-b1a0-64510651abcf',
        inputs: [
          {
            intent: 'action.devices.QUERY',
            payload: {
              devices: [{ id: deviceId }, { id: 'nofound' }]
            }
          }
        ]
      })
      .expect(200);

    expect(res.body.requestId).toEqual('ff36a3cc-ec34-11e6-b1a0-64510651abcf');

    // device found
    expect(res.body.payload.devices[deviceId].status).toEqual('SUCCESS');
    expect(res.body.payload.devices[deviceId].online).toEqual(true);
    expect(res.body.payload.devices[deviceId].isRunning).toEqual(true);
    expect(res.body.payload.devices[deviceId].dispenseItems.length).toEqual(1);
    expect(res.body.payload.devices[deviceId].dispenseItems[0].isCurrentlyDispensing).toBeFalsy();

    // device not found
    expect(res.body.payload.devices['nofound'].status).toEqual('ERROR');
    expect(res.body.payload.devices['nofound'].online).toEqual(false);
    expect(res.body.payload.devices['nofound'].errorCode).toEqual(
      'Device is not available in the system'
    );

    devices.push(deviceId);
  });

  it('should response to the EXECUTE StartStop request', async () => {
    const onMessage = (msg: any) => {
      expect(msg.payload.messageType).toEqual('EXECUTE');
      expect(msg.payload.command).toBeTruthy();
      expect(msg.payload.command.start).toEqual(true);
      return msg;
    };
    const deviceId = await connectDevices(onMessage);

    const token = createAccessToken();
    const res = await request(app)
      .post('/api/devices/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: 'ff46a3cc-ec34-11e6-b1a0-64510651abcf',
        inputs: [
          {
            intent: 'action.devices.EXECUTE',
            payload: {
              commands: [
                {
                  devices: [{ id: deviceId }, { id: 'nofound' }],
                  execution: [
                    {
                      command: 'action.devices.commands.StartStop',
                      params: { start: true }
                    }
                  ]
                }
              ]
            }
          }
        ]
      })
      .expect(200);

    expect(res.body.requestId).toEqual('ff46a3cc-ec34-11e6-b1a0-64510651abcf');

    // device found
    const index1 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === deviceId);
    expect(res.body.payload.commands[index1].ids[0]).toEqual(deviceId);
    expect(res.body.payload.commands[index1].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[index1].states.isRunning).toEqual(true);
    expect(res.body.payload.commands[index1].states.online).toEqual(true);
    expect(res.body.payload.commands[index1].states.dispenseItems.length).toEqual(1);
    expect(
      res.body.payload.commands[index1].states.dispenseItems[0].isCurrentlyDispensing
    ).toBeFalsy();

    // device not found
    const index2 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === 'nofound');
    expect(res.body.payload.commands[index2].ids[0]).toEqual('nofound');
    expect(res.body.payload.commands[index2].status).toEqual('ERROR');
    expect(res.body.payload.commands[index2].errorCode).toEqual(
      'Device is not available in the system'
    );

    devices.push(deviceId);
  });

  it('should response to the EXECUTE Dispense request', async () => {
    const onMessage = (msg: any) => {
      expect(msg.payload.messageType).toEqual('EXECUTE');
      expect(msg.payload.command).toBeTruthy();
      expect(msg.payload.command.start).toEqual(true);
      return msg;
    };
    const deviceId = await connectDevices(onMessage);

    const token = createAccessToken();
    const res = await request(app)
      .post('/api/devices/fulfillment')
      .set('Authorization', `Bearer ${token}`)
      .send({
        requestId: 'ff46a3cc-ec34-11e6-b1a0-64510651abcf',
        inputs: [
          {
            intent: 'action.devices.EXECUTE',
            payload: {
              commands: [
                {
                  devices: [{ id: deviceId }, { id: 'nofound' }],
                  execution: [
                    {
                      command: 'action.devices.commands.Dispense',
                      params: { amount: 1, unit: 'PORTION', item: 'aquarium-fish-food' }
                    }
                  ]
                }
              ]
            }
          }
        ]
      })
      .expect(200);

    expect(res.body.requestId).toEqual('ff46a3cc-ec34-11e6-b1a0-64510651abcf');

    // device found
    const index1 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === deviceId);
    expect(res.body.payload.commands[index1].ids[0]).toEqual(deviceId);
    expect(res.body.payload.commands[index1].status).toEqual('SUCCESS');
    expect(res.body.payload.commands[index1].states.isRunning).toEqual(true);
    expect(res.body.payload.commands[index1].states.online).toEqual(true);
    expect(res.body.payload.commands[index1].states.dispenseItems.length).toEqual(1);
    expect(
      res.body.payload.commands[index1].states.dispenseItems[0].isCurrentlyDispensing
    ).toBeFalsy();

    // device not found
    const index2 = res.body.payload.commands.findIndex((c: any) => c.ids[0] === 'nofound');
    expect(res.body.payload.commands[index2].ids[0]).toEqual('nofound');
    expect(res.body.payload.commands[index2].status).toEqual('ERROR');
    expect(res.body.payload.commands[index2].errorCode).toEqual(
      'Device is not available in the system'
    );

    devices.push(deviceId);
  });

  async function connectDevices(onMessage = (msg: any) => msg) {
    return await createClient(
      {
        messageType: 'QUERY',
        payload: {
          isRunning: true,
          type: 'action.devices.types.PETFEEDER',
          name: { name: 'td3' }
        }
      },
      onMessage
    );
  }
});
