const express = require('express');
const router = express.Router();
const lightsRouter = require('./lights');
const validateToken = require("../../middlewares/validate-token");

router.use(validateToken);
router.use('/lights', lightsRouter);

module.exports = router;
