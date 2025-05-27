import express from 'express';

import {models} from '../../models';
import webSocket from '../../socket/web-socket';
import env from '../../environments';
import {COMMAND_ON_OFF, COMMAND_START_STOP, DEVICE_TYPE_PETFEEDER, DEVICE_TYPE_OUTLET} from '../../utils';

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
  webSocket.sendMessage(req.params.lid, { on: true });
  res.send('');
});

router.post('/:lid/off', (req, res) => {
  webSocket.sendMessage(req.params.lid, { on: false });
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

async function handleAction(action: any) {
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

async function queryAction(action: any) {
  const res: {devices: any} = { devices: {} };
  for (let d of action.payload.devices) {
    const existDevice = await models.Device.exist(d.id);
    if (existDevice) {
      let isConnected = webSocket.connectedDevices.has(d.id);
      if (isConnected) {
        try {
          await webSocket.sendMessageWaitResponse(d.id, { payload: { messageType: 'QUERY' } });
        } catch (ignore) {
          isConnected = false;
        }
      }
      if (isConnected) {
        const de = await models.Device.findOne({ did: d.id });
        res.devices[d.id] = {
          status: 'SUCCESS',
          online: true,
          ...stateByType(de)
        };
      } else {
        res.devices[d.id] = {
          status: 'OFFLINE',
          online: false
        };
      }
    } else {
      res.devices[d.id] = {
        status: 'ERROR',
        online: false,
        errorCode: 'Device is not available in the system'
      };
    }
  }
  return res;
}

async function executeAction(action: any) {
  const payload: {commands: any[]} = { commands: [] }
  const errors = [];
  const offlines = [];
  for (let c of action.payload.commands) {
    for (let exe of c.execution) {
      let commandRes: { ids: string[], status: string, states?: any, errorCode?: string } = { ids: [], status: 'ERROR' };
      if (exe.command === COMMAND_ON_OFF) {
        commandRes = { ids: [], status: "SUCCESS", states: { on: exe.params.on, online: true } };
      } else if (exe.command === COMMAND_START_STOP) {
        commandRes = { ids: [], status: "SUCCESS", states: { isRunning: exe.params.start, online: true } };
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
              });
              device = await models.Device.findOne({ did: d.id });
              commandRes.states = { ...stateByType(device), online: true };
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

function commandToSendByType(type: string, exe: any) {
  switch (type) {
    case DEVICE_TYPE_PETFEEDER:
      return { start: exe.params.start };
    case DEVICE_TYPE_OUTLET:
      return { on: exe.params.on };
    default:
      return {};
  }
}

function traitsByType(type: string): string[] {
  switch (type) {
    case DEVICE_TYPE_PETFEEDER:
      return ['action.devices.traits.StartStop'];
    case DEVICE_TYPE_OUTLET:
      return ['action.devices.traits.OnOff'];
    default:
      return [];
  }
}

function stateByType(de: any) {
  switch (de.type) {
    case DEVICE_TYPE_PETFEEDER:
      return { isRunning: de.params.isRunning }
    case DEVICE_TYPE_OUTLET:
    default:
      return { on: de.params.on }
  }
}

function attributesByType(type: string): { pausable?: boolean } | undefined {
  switch (type) {
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
    case DEVICE_TYPE_PETFEEDER:
      return false;
    case DEVICE_TYPE_OUTLET:
    default:
      return false;
  }
}

export default router;
