const express = require('express');
const router = express.Router();

const {models} = require('../../models');
const webSocket = require('../../socket/web-socket');
const env = require('../../environments');

router.get('/', async (req, res, next) => {
  const lights = await models.Device.find();
  res.send(lights);
});

router.post('/:lid/on', (req, res) => {
  webSocket.sendMessage(req.params.lid, {on: true});
  res.send('');
});

router.post('/:lid/off', (req, res) => {
  webSocket.sendMessage(req.params.lid, {on: false});
  res.send('');
});

router.post('/fulfillment', async (req, res) => {
  const {requestId, inputs} = req.body;
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
  } catch (e) {
    console.log(e);
    res.status(500);
    res.send({error: e.toString()});
  }
});

async function handleAction(action) {
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
  // const lights = Array.from(data.lights);
  const lights = await models.Device.find();
  return {
    agentUserId: env.googleUserId,
    devices: lights.map((l) => {
      const {_id, ...name} = l.name.toJSON();
      return {
        id: l.did,
        type: l.type,
        traits: traitsByType(l.type),
        name,
        willReportState: willRepostStateByType(l.type),
        attributes: attributesByType(l.type)
      };
    })
  };
}

async function queryAction(action) {
  const res = {devices: {}};
  for (let d of action.payload.devices) {
    const existDevice = await models.Device.exist(d.id);
    if (existDevice) {
      let isConnected = webSocket.connectedDevices.has(d.id);
      if (isConnected) {
        try {
          await webSocket.sendMessageWaitResponse(d.id, {payload: {messageType: 'QUERY'}});
        } catch (ignore) {
          isConnected = false;
        }
      }
      if (isConnected) {
        const de = await models.Device.findOne({did: d.id});
        res.devices[d.id] = {
          status: 'SUCCESS',
          online: true,
          ...stateBytype(de)
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

async function executeAction(action) {
  const payload = {commands: []}
  const errors = [];
  const offlines = [];
  for (let c of action.payload.commands) {
    for (let exe of c.execution) {
      let commandRes;
      if (exe.command === 'action.devices.commands.OnOff') {
        commandRes = {ids: [], status: "SUCCESS", states: {on: exe.params.on, online: true}};
      } else if (exe.command === 'action.devices.commands.StartStop') {
        commandRes = {ids: [], status: "SUCCESS", states: {isRunning: exe.params.start, online: true}};
      } else {
        // toDo guille 16.06.22: not handle commands
        return;
      }

      for (let d of c.devices) {
        const existDevice = await models.Device.exist(d.id);
        if (existDevice) {
          let isConnected = webSocket.connectedDevices.has(d.id);
          if (isConnected) {
            try {
              await webSocket.sendMessageWaitResponse(d.id, {
                payload: {
                  messageType: 'EXECUTE',
                  command: {on: exe.params.on}
                }
              });
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
    const commandRes = {ids: [], status: 'OFFLINE', states: {online: false}};
    offlines.forEach(e => commandRes.ids.push(e.id));
    payload.commands.push(commandRes);
  }

  if (errors.length > 0) {
    const commandRes = {ids: [], status: 'ERROR', errorCode: 'Device is not available in the system'};
    errors.forEach(e => commandRes.ids.push(e.id));
    payload.commands.push(commandRes);
  }

  return payload;
}

function traitsByType(type) {
  switch (type) {
    case 'action.devices.types.PETFEEDER':
      return ['action.devices.traits.StartStop'];
    case 'action.devices.types.OUTLET':
      return ['action.devices.traits.OnOff'];
    default:
      return [];
  }
}

function stateBytype(de) {
  switch (de.type) {
    case 'action.devices.types.PETFEEDER':
      return {isRunning: de.params.on}
    case 'action.devices.types.OUTLET':
    default:
      return {on: de.params.on}
  }
}

function attributesByType(type) {
  switch (type) {
    case 'action.devices.types.PETFEEDER':
      return {
        pausable: false
      };
    case 'action.devices.types.OUTLET':
    default:
      return undefined;
  }
}

function willRepostStateByType(type) {
  switch (type) {
    case 'action.devices.types.PETFEEDER':
      return true;
    case 'action.devices.types.OUTLET':
    default:
      return false;
  }
}

module.exports = router;
