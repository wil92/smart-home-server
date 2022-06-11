const jwt = require('jsonwebtoken');
const env = require('../environments');
const {ACCESS_TOKEN_TYPE} = require("../utils");

function validateToken(req, res, next) {
  if (req.headers['authorization']) {
    try {
      const token = req.headers['authorization'].replace(/^Bearer /, '');
      const payload = jwt.verify(token, env.key);
      if (payload.type !== ACCESS_TOKEN_TYPE) {
        throw new Error('Invalid token');
      }
      return next();
    } catch (e) {
      console.error(e)
    }
  }
  res.status(401);
  res.send({error: 'Invalid access token'});
}

module.exports = validateToken;
