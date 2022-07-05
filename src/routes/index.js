const express = require('express');
const router = express.Router();
const isLogin = require("../middlewares/is-login");
const {models} = require("../models");

router.use(isLogin);

/* GET home page. */
router.get('/', async (req, res, next) => {
  const devices = await models.Device.find({});
  console.log(devices.map(d => d.toJSON()))
  res.render('index', {
    devices: devices.map(d => d.toJSON())
  });
});

router.get('/policy', function (req, res, next) {
  res.render('policy.ejs', {title: 'Policy'});
});

module.exports = router;
