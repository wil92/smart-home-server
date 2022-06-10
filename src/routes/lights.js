const express = require('express');
const router = express.Router();
const webSocket = require('../socket/web-socket');

const data = require('../data');

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

module.exports = router;
