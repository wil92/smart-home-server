const express = require('express');
const router = express.Router();
const devicesRouter = require('./devices');
const validateToken = require("../../middlewares/validate-token");

router.use(validateToken);
router.use('/lights', devicesRouter); // deprecated
router.use('/devices', devicesRouter);

module.exports = router;
