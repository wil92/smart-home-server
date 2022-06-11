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
      break;
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
    devices: lights.map(l => ({
      id: '',
      type: '',
      traits: [
        'action.devices.traits.OnOff'
      ],
      name: {
        name: 'light 1'
      },
      willReportState: false
    }))
  };
}

module.exports = router;
