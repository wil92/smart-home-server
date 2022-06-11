const express = require('express');
const router = express.Router();
const isLogin = require("../middlewares/is-login");

const data = require('../data');

router.use(isLogin);

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {title: 'Express', data});
});

module.exports = router;
