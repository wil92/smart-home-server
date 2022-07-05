const express = require('express');
const router = express.Router();

const isLogin = require("../middlewares/is-login");
const {models} = require("../models");
const ws = require('../socket/web-socket');

router.use(isLogin);

/* GET home page. */
router.get('/', async (req, res, next) => {
  let devices = await models.Device.find({});
  devices = devices.map(d => {
    return {
      ...d.toJSON(),
      online: ws.connectedDevices.has(d.did)
    };
  });
  res.render('index', {devices});
});

router.get('/policy', function (req, res, next) {
  res.render('policy.ejs', {title: 'Policy'});
});

module.exports = router;
