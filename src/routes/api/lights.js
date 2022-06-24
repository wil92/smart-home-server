const express = require('express');
const router = express.Router();
const webSocket = require('../../socket/web-socket');

const env = require('../../environments');
const data = require('../../data');

router.get('/', (req, res, next) => {
  res.send(Array.from(data.lights).map(([k, v]) => v));
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

  for (let i = 0; i < inputs.length; i++) {
    const action = inputs[i];
    payload = await handleAction(action);
  }

  res.send({
    requestId,
    payload
  });
});

async function handleAction(action) {
  switch (action['intent']) {
    case 'action.devices.SYNC':
      return syncAction();
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

function syncAction() {
  const lights = Array.from(data.lights);
  return {
    agentUserId: env.googleUserId,
    devices: lights.map(([id, l]) => ({
      id,
      type: l.type,
      traits: traitsByType(l.type),
      name: l.name,
      willReportState: false
    }))
  };
}

async function queryAction(action) {
  const res = {devices: {}};
  for (let d of action.payload.devices) {
    if (data.lights.has(d.id)) {
      await webSocket.sendMessageWaitResponse(d.id, {payload: {messageType: 'QUERY'}});
      const currentDevice = data.lights.get(d.id);
      res.devices[d.id] = {
        status: 'SUCCESS',
        online: true,
        on: currentDevice.on
      }
    } else {
      res.devices[d.id] = {
        status: 'OFFLINE',
        online: false
      }
    }
  }
  return res;
}

async function executeAction(action) {
  const payload = {commands: []}
  const errors = [];
  for (let c of action.payload.commands) {
    for (let exe of c.execution) {
      let commandRes;
      if (exe.command === 'action.devices.commands.OnOff') {
        commandRes = {ids: [], status: "SUCCESS", states: {on: exe.params.on, online: true}};
      } else {
        // toDo guille 16.06.22: not handle command
        return;
      }

      for (let d of c.devices) {
        if (data.lights.has(d.id)) {
          const currentDevice = data.lights.get(d.id);
          // toDo guille 16.06.22: execute action here
          await webSocket.sendMessageWaitResponse(d.id, {
            payload: {
              messageType: 'EXECUTE',
              command: {on: exe.params.on}
            }
          })
            .then(() => {
              commandRes.ids.push(d.id);
            }).catch((e) => {
              console.error(e);
              errors.push(d);
            });
        } else {
          errors.push(d);
        }
      }

      payload.commands.push(commandRes);
    }
  }

  if (errors.length > 0) {
    const commandRes = {ids: [], status: 'OFFLINE', states: {online: false}};
    errors.forEach(e => commandRes.ids.push(e.id));
    payload.commands.push(commandRes);
  }

  return payload;
}

function traitsByType(type) {
  switch (type) {
    case 'action.devices.types.OUTLET':
      return ['action.devices.traits.OnOff'];
    default:
      return [];
  }
}

module.exports = router;
