import express from 'express';
import { filter, firstValueFrom } from 'rxjs';

import { models } from '../../models';
import webSocket, { WSMessage, WSMessageResponse } from '../../socket/web-socket';
import { env } from '../../environments';
import {
  COMMAND_ON_OFF,
  COMMAND_START_STOP,
  DEVICE_TYPE_PETFEEDER,
  DEVICE_TYPE_OUTLET,
  DEVICE_TYPE_CAMERA,
  COMMAND_GET_CAMERA_STREAM,
  sanitizeDevice,
  COMMAND_DISPENSE
} from '../../utils';
import { IDevice } from '../../models/device';
import RequestInput from './models/request-input';
import FulfillmentResponse from './models/fulfillment-response';
import { QueryDevices } from './models/payload';
import FulfillmentRequest from './models/fulfillment-request';
import Device, { Attributes } from './models/device';
import { TraitType } from './models/trait.type';
import Command from './models/command';
import QueryDevice from './models/query-device';
import { CameraAttributes, FeederAttributes, OutletAttributes } from './models/device-attributes';

const router = express.Router();

// GET devices listing.
router.get('/', async (_req, res, _next) => {
  const devices = (await models.Device.find({})) as unknown as any;
  const response = [];

  for (const device of devices) {
    response.push(sanitizeDevice(device));
  }

  res.status(200).json(response);
});

// GET device by id.
router.get('/:did', async (req, res, _next) => {
  const device = await models.Device.findOne({ did: req.params.did });
  if (device) {
    res.status(200).json(sanitizeDevice(device));
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

// DELETE device by id.
router.delete('/:did', async (req: any, res: any) => {
  return models.Device.deleteOne({ did: req.params.did })
    .then(() => res.send(''))
    .catch((e) => {
      console.error(e);
      res.status(500);
      res.send({ error: e.toString() });
    });
});

router.post('/:lid/on', (req, res) => {
  webSocket.sendMessage(req.params.lid, {
    payload: {
      command: { on: true },
      messageType: 'EXECUTE'
    }
  } as WSMessageResponse);
  res.send({});
});

router.post('/:lid/off', (req, res) => {
  webSocket.sendMessage(req.params.lid, {
    payload: {
      command: { on: false },
      messageType: 'EXECUTE'
    }
  } as WSMessageResponse);
  res.send('');
});

// POST fulfillment request from Google Home.
router.post('/fulfillment', async (req, res) => {
  const { requestId, inputs } = req.body as FulfillmentRequest;

  try {
    let devices: Device[] | QueryDevices | undefined = undefined;
    let commands: Command[] | undefined = undefined;
    for (let i = 0; i < inputs.length; i++) {
      const action = inputs[i];

      if (action.intent === 'action.devices.DISCONNECT') {
        break;
      } else if (action.intent === 'action.devices.SYNC') {
        if (!devices) {
          devices = [];
        }
        devices = [...(devices as Device[]), ...((await handleAction(action)) as Device[])];
      } else if (action.intent === 'action.devices.EXECUTE') {
        if (!commands) {
          commands = [];
        }
        commands = [...(commands as Command[]), ...((await handleAction(action)) as Command[])];
      } else if (action.intent === 'action.devices.QUERY') {
        if (!devices) {
          devices = {};
        }
        devices = {
          ...(devices as QueryDevices),
          ...((await handleAction(action)) as QueryDevices)
        };
      }
    }

    res.send({
      requestId,
      payload: {
        agentUserId: env.googleUserId,
        devices,
        commands
      }
    } as FulfillmentResponse);
  } catch (error) {
    console.error(error);
    res.status(500);
    res.send({ error });
  }
});

async function handleAction(action: RequestInput): Promise<Device[] | QueryDevices | Command[]> {
  switch (action.intent) {
    case 'action.devices.SYNC':
      return await syncAction();
    case 'action.devices.QUERY':
      return await queryAction(action);
    case 'action.devices.EXECUTE':
      return await executeAction(action);
    case 'action.devices.DISCONNECT':
    default:
      throw new Error(`Unsupported intent: ${action.intent}`);
  }
}

async function syncAction(): Promise<Device[]> {
  const devices = await models.Device.find();
  return devices.map((l: any) => {
    const { ...name } = l.name.toJSON();
    return {
      id: l.did,
      type: l.type,
      traits: traitsByType(l.type),
      name: { name: name.name },
      willReportState: willReportStateByType(l.type),
      attributes: attributesByType(l.type)
    } as Device;
  });
}

async function queryAction(action: RequestInput): Promise<QueryDevices> {
  const devices: QueryDevices = {};
  for (const device of action.payload?.devices || []) {
    const existDevice = await models.Device.exist(device.id);
    if (existDevice) {
      let isConnected = webSocket.connectedDevices.has(device.id);
      if (isConnected) {
        try {
          await webSocket.sendMessageWaitResponse(device.id, {
            payload: { messageType: 'QUERY' }
          } as WSMessageResponse);
        } catch (err) {
          console.error(`Error querying device ${device.id}:`, err);
          isConnected = false;
        }
      }
      if (isConnected) {
        const dbDevice = await models.Device.findOne({ did: device.id });
        devices[device.id] = {
          status: 'SUCCESS',
          online: true,
          ...(await stateByType(dbDevice))
        } as QueryDevice;
      } else {
        devices[device.id] = {
          status: 'OFFLINE',
          online: false
        } as QueryDevice;
      }
    } else {
      devices[device.id] = {
        status: 'ERROR',
        online: false,
        errorCode: 'Device is not available in the system'
      } as QueryDevice;
    }
  }
  return devices;
}

async function executeAction(action: RequestInput): Promise<Command[]> {
  const commands: Command[] = [];
  const errors = [];
  const offline = [];
  for (const c of action.payload?.commands || []) {
    for (const exe of c.execution) {
      let commandRes: Command = {
        ids: [],
        status: 'ERROR'
      };
      if (exe.command === COMMAND_ON_OFF) {
        commandRes = {
          ids: [],
          status: 'SUCCESS',
          states: { on: exe.params.on, online: true }
        } as Command;
      } else if (exe.command === COMMAND_START_STOP || exe.command === COMMAND_DISPENSE) {
        exe.params.start = true;
        commandRes = {
          ids: [],
          status: 'SUCCESS',
          states: { isRunning: Boolean(exe.params.start), online: true }
        } as Command;
      } else if (exe.command === COMMAND_GET_CAMERA_STREAM) {
        commandRes = { ids: [], status: 'SUCCESS', states: { online: true } } as Command;
      } else {
        // toDo guille 16.06.22: not handle commands
        return [];
      }

      for (const d of c.devices) {
        let device = await models.Device.findOne({ did: d.id });
        if (device) {
          let isConnected = webSocket.connectedDevices.has(d.id);
          if (isConnected) {
            try {
              await webSocket.sendMessageWaitResponse(d.id, {
                payload: {
                  messageType: 'EXECUTE',
                  command: commandToSendByType(device.type, exe)
                }
              } as WSMessageResponse);
              webSocket.updateLastStreamingRequest(d.id, true);
              device = await models.Device.findOne({ did: d.id });
              commandRes.states = { ...(await stateByType(device, true)), online: true };
            } catch (_err) {
              isConnected = false;
            }
          }
          if (isConnected) {
            commandRes.ids.push(d.id);
          } else {
            offline.push(d);
          }
        } else {
          errors.push(d);
        }
      }

      if (commandRes.ids.length > 0) {
        commands.push(commandRes);
      }
    }
  }

  if (offline.length > 0) {
    const commandRes: Command = {
      ids: [],
      status: 'OFFLINE',
      states: { online: false }
    };
    offline.forEach((e: { id: string }) => commandRes.ids.push(e.id));
    commands.push(commandRes);
  }

  if (errors.length > 0) {
    const commandRes: Command = {
      ids: [],
      status: 'ERROR',
      errorCode: 'Device is not available in the system'
    };
    errors.forEach((e) => commandRes.ids.push(e.id));
    commands.push(commandRes);
  }

  return commands;
}

function commandToSendByType(type: string, exe: any): any {
  switch (type) {
    case DEVICE_TYPE_PETFEEDER:
      return { start: exe.params.start };
    case DEVICE_TYPE_OUTLET:
      return { on: exe.params.on };
    case DEVICE_TYPE_CAMERA:
      return { on: exe.params.StreamToChromecast };
    default:
      return {} as WSMessageResponse;
  }
}

function traitsByType(type: string): TraitType[] {
  switch (type) {
    case DEVICE_TYPE_PETFEEDER:
      return ['action.devices.traits.Dispense', 'action.devices.traits.StartStop'];
    case DEVICE_TYPE_OUTLET:
      return ['action.devices.traits.OnOff'];
    case DEVICE_TYPE_CAMERA:
      return ['action.devices.traits.CameraStream'];
    default:
      return [];
  }
}

async function stateByType(
  de: IDevice | any,
  waitFirstImage: boolean = false
): Promise<CameraAttributes | FeederAttributes | OutletAttributes> {
  switch (de.type) {
    case DEVICE_TYPE_CAMERA:
      if (waitFirstImage) {
        await firstValueFrom(
          webSocket.incomeMessages.pipe(
            filter((msg: WSMessage) => msg.payload.id === de.did && msg.messageType === 'JSON')
          )
        );
      }
      return {
        cameraStreamAccessUrl: `${env.apiHost}/stream/hls/${de.did}.m3u8`,
        cameraStreamProtocol: 'hls'
        // cameraStreamAuthToken: 'some-auth-token',
        // cameraStreamReceiverAppId: 'some-app-id',
      } as CameraAttributes;
    case DEVICE_TYPE_PETFEEDER:
      return {
        isRunning: de.params.isRunning,
        dispenseItems: [
          {
            itemName: 'aquarium-fish-food',
            isCurrentlyDispensing: false
          }
        ]
      } as FeederAttributes;
    case DEVICE_TYPE_OUTLET:
      return { on: de.params.on } as OutletAttributes;
    default:
      return {} as QueryDevice;
  }
}

function attributesByType(type: string): Attributes {
  switch (type) {
    case DEVICE_TYPE_CAMERA:
      return {
        cameraStreamSupportedProtocols: ['hls'],
        cameraStreamNeedAuthToken: false,
        cameraStreamNeedDrmEncryption: false
      } as Attributes;
    case DEVICE_TYPE_PETFEEDER:
      return {
        pausable: false,
        supportedDispenseItems: [
          {
            item_name: 'aquarium-fish-food',
            item_name_synonyms: [
              { lang: 'es', synonyms: ['Alimento para peces de acuario'] },
              { lang: 'en', synonyms: ['Aquarium Fish Food'] }
            ],
            supported_units: ['PORTION'],
            default_portion: { amount: 1, unit: 'PORTION' }
          }
        ],
        supportedDispensePresets: [
          {
            preset_name: 'dispense-portion',
            preset_name_synonyms: [
              { lang: 'es', synonyms: ['Dispensar una porción'] },
              { lang: 'en', synonyms: ['Dispense a portion'] }
            ]
          }
        ]
      } as Attributes;
    case DEVICE_TYPE_OUTLET:
    default:
      return {} as Attributes;
  }
}

function willReportStateByType(type: string): boolean {
  switch (type) {
    case DEVICE_TYPE_CAMERA:
      return true;
    case DEVICE_TYPE_PETFEEDER:
    case DEVICE_TYPE_OUTLET:
    default:
      return false;
  }
}

export default router;
