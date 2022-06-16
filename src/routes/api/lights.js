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

router.post('/fulfillment', (req, res) => {
  const {requestId, inputs} = req.body;
  let payload;

  for (let i = 0; i < inputs.length; i++) {
    const action = inputs[i];
    payload = handleAction(action);
  }

  res.send({
    requestId,
    payload
  });
});

function handleAction(action) {
  switch (action['intent']) {
    case 'action.devices.SYNC':
      return syncAction();
    case 'action.devices.QUERY':
      return queryAction(action);
    case 'action.devices.EXECUTE':
      break;
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

function queryAction(action) {
  const res = {devices: {}};
  action.payload.devices.map(d => {

    // toDo guille 16.06.22: get device status thrown WS
    if (data.lights.has(d.id)) {
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
  });
  return res;
}

function executeAction(action) {
  const error = [];
  action.payload.commands.forEach(c => {
    c.devices.forEach(d => {
      if (data.lights.has(d.id)) {
        const currentDevice = data.lights.get(d.id);

      } else {
        error.push(d);
      }
    })
  });
}

function traitsByType(type) {
  switch (type){
    case 'action.devices.types.OUTLET':
      return ['action.devices.traits.OnOff'];
    default:
      return [];
  }
}

module.exports = router;
