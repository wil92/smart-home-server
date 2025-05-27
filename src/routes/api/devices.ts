import express from 'express';

import {models} from '../../models';
import webSocket, {WSMessage, WSMessageResponse} from '../../socket/web-socket';
import env from '../../environments';
import {
  COMMAND_ON_OFF,
  COMMAND_START_STOP,
  DEVICE_TYPE_PETFEEDER,
  DEVICE_TYPE_OUTLET,
  DEVICE_TYPE_CAMERA, COMMAND_GET_CAMERA_STREAM
} from '../../utils';
import Device, {IDevice} from "../../models/device";
import {filter, firstValueFrom} from "rxjs";

const router = express.Router();

router.get('/', async (req, res, next) => {
  const devices  = await models.Device.find({}) as unknown as any;

  for (let device of devices) {
    device.online = webSocket.connectedDevices.has(device.did);
  }

  res.send(devices);
});

router.delete('/:did', async (req: any, res: any) => {
  return models.Device.deleteOne({ did: req.params.did })
    .then(() => res.send(''))
    .catch(e => {
      console.error(e);
      res.status(500);
      res.send({ error: e.toString() });
    });
});

router.post('/:lid/on', (req, res) => {
  webSocket.sendMessage(req.params.lid, { payload: {command: {on: true}, messageType: 'EXECUTE'} } as WSMessageResponse);
  res.send('');
});

router.post('/:lid/off', (req, res) => {
  webSocket.sendMessage(req.params.lid, { payload: {command: {on: false}, messageType: 'EXECUTE'} } as WSMessageResponse);
  res.send('');
});

router.post('/fulfillment', async (req, res) => {
  const { requestId, inputs } = req.body;
  let payload;

  try {
    for (let i = 0; i < inputs.length; i++) {
      const action = inputs[i];
      payload = await handleAction(action);
    }

    res.send({
      requestId,
      payload
    });
  } catch (e: any) {
    console.log(e);
    res.status(500);
    res.send({ error: e.toString() });
  }
});

interface Action {
  intent: 'action.devices.DISCONNECT' | 'action.devices.SYNC' | 'action.devices.QUERY' | 'action.devices.EXECUTE';
  payload: {
    commands?: {
      devices: {
        id: string;
      }[];
      execution: {
        command: string;
        params: {
          start?: boolean;
          on?: boolean;
          StreamToChromecast?: boolean;
          SupportedStreamProtocols?: string[];
        };
      }[];
    }[];
    devices?: {
      id: string;
    }[];
  }
}

async function handleAction(action: Action) {
  switch (action['intent']) {
    case 'action.devices.SYNC':
      return await syncAction();
    case 'action.devices.QUERY':
      return await queryAction(action);
    case 'action.devices.EXECUTE':
      return await executeAction(action);
    case 'action.devices.DISCONNECT':
      break;
    default:
      break;
  }
}

async function syncAction() {
  const devices = await models.Device.find();
  return {
    agentUserId: env.googleUserId,
    devices: devices.map((l: any) => {
      const { _id, ...name } = l.name.toJSON();
      return {
        id: l.did,
        type: l.type,
        traits: traitsByType(l.type),
        name,
        willReportState: willReportStateByType(l.type),
        attributes: attributesByType(l.type)
      };
    })
  };
}

async function queryAction(action: Action) {
  const res: {devices: any} = { devices: {} };
  for (let d of action.payload?.devices || []) {
    const existDevice = await models.Device.exist(d.id);
    if (existDevice) {
      let isConnected = webSocket.connectedDevices.has(d.id);
      if (isConnected) {
        try {
          await webSocket.sendMessageWaitResponse(d.id, { payload: { messageType: 'QUERY' } } as WSMessageResponse);
        } catch (ignore) {
          isConnected = false;
        }
      }
      if (isConnected) {
        const de = await models.Device.findOne({ did: d.id });
        res.devices[d.id] = {
          status: 'SUCCESS',
          online: true,
          ...(await stateByType(de))
        };
      } else {
        res.devices[d.id] = {
          status: 'OFFLINE',
          online: false
        };
      }
    } else {
      console.log('11111111111111111111111')
      res.devices[d.id] = {
        status: 'ERROR',
        online: false,
        errorCode: 'Device is not available in the system'
      };
    }
  }
  return res;
}

async function executeAction(action: Action) {
  const payload: {commands: any[]} = { commands: [] }
  const errors = [];
  const offlines = [];
  for (let c of action.payload?.commands || []) {
    for (let exe of c.execution) {
      let commandRes: { ids: string[], status: string, states?: any, errorCode?: string } = { ids: [], status: 'ERROR' };
      if (exe.command === COMMAND_ON_OFF) {
        commandRes = { ids: [], status: "SUCCESS", states: { on: exe.params.on, online: true } };
      } else if (exe.command === COMMAND_START_STOP) {
        commandRes = { ids: [], status: "SUCCESS", states: { isRunning: exe.params.start, online: true } };
      } else if (exe.command === COMMAND_GET_CAMERA_STREAM) {
        commandRes = { ids: [], status: "SUCCESS", states: { online: true } };
      } else {
        // toDo guille 16.06.22: not handle commands
        return;
      }

      for (let d of c.devices) {
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
              device = await models.Device.findOne({ did: d.id });
              commandRes.states = { ...(await stateByType(device)), online: true };
            } catch (e) {
              isConnected = false;
            }
          }
          if (isConnected) {
            commandRes.ids.push(d.id);
          } else {
            offlines.push(d);
          }
        } else {
          errors.push(d);
        }
      }

      if (commandRes.ids.length > 0) {
        payload.commands.push(commandRes);
      }
    }
  }

  if (offlines.length > 0) {
    const commandRes: {ids: any[], status: string, states: {online: boolean}} = { ids: [], status: 'OFFLINE', states: { online: false } };
    offlines.forEach((e: {id: string})=> commandRes.ids.push(e.id));
    payload.commands.push(commandRes);
  }

  if (errors.length > 0) {
    const commandRes: {ids: any[], status: string, errorCode: string} = { ids: [], status: 'ERROR', errorCode: 'Device is not available in the system' };
    errors.forEach(e => commandRes.ids.push(e.id));
    payload.commands.push(commandRes);
  }

  return payload;
}

function commandToSendByType(type: string, exe: any): any {
  switch (type) {
    case DEVICE_TYPE_PETFEEDER:
      return { start: exe.params.start };
    case DEVICE_TYPE_OUTLET:
      return { on: exe.params.on };
    case DEVICE_TYPE_CAMERA:
      return {on: exe.params.StreamToChromecast};
    default:
      return {} as WSMessageResponse;
  }
}

function traitsByType(type: string): string[] {
  switch (type) {
    case DEVICE_TYPE_PETFEEDER:
      return ['action.devices.traits.StartStop'];
    case DEVICE_TYPE_OUTLET:
      return ['action.devices.traits.OnOff'];
    case DEVICE_TYPE_CAMERA:
      return ['action.devices.traits.CameraStream'];
    default:
      return [];
  }
}

async function stateByType(de: IDevice | any) {
  switch (de.type) {
    case DEVICE_TYPE_CAMERA:
      await firstValueFrom(webSocket.incomeMessages.pipe(
          filter((msg: WSMessage) => msg.payload.id === de.did && msg.messageType === 'JSON'))
      );
      return {
        cameraStreamAccessUrl: `${env.apiHost}/stream/hls/${de.did}.m3u8`,
        cameraStreamProtocol: 'hls',
        // cameraStreamAuthToken: 'some-auth-token',
        // cameraStreamReceiverAppId: 'some-app-id',
      };
    case DEVICE_TYPE_PETFEEDER:
      return { isRunning: de.params.isRunning }
    case DEVICE_TYPE_OUTLET:
      return { on: de.params.on }
    default:
      return {};
  }
}

function attributesByType(type: string): any {
  switch (type) {
    case DEVICE_TYPE_CAMERA:
      return {
        cameraStreamSupportedProtocols: ['hls'],
        cameraStreamNeedAuthToken: false,
        cameraStreamNeedDrmEncryption: false,
      };
    case DEVICE_TYPE_PETFEEDER:
      return {
        pausable: false
      };
    case DEVICE_TYPE_OUTLET:
    default:
      return undefined;
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
