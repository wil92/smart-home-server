const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");

const env = require('./environments');

const CODE_TOKEN_TYPE = 'code';
const REFRESH_TOKEN_TYPE = 'refresh_token';
const ACCESS_TOKEN_TYPE = 'access_token';

const COMMAND_ON_OFF = 'action.devices.commands.OnOff';
const COMMAND_START_STOP = 'action.devices.commands.StartStop';

const DEVICE_TYPE_PETFEEDER = 'action.devices.types.PETFEEDER';
const DEVICE_TYPE_OUTLET = 'action.devices.types.OUTLET';

/**
 * @param query {object}
 * @returns {string}
 */
function queryToStr(query) {
  return Object.keys(query).reduce((p, k, i) => {
    let q = `${k}=${encodeURI(query[k])}`;
    if (i > 0) {
      q = `${p}&${q}`;
    }
    return q;
  }, '');
}

function createCode() {
  return createToken({type: CODE_TOKEN_TYPE});
}

function auth2Response(withRefreshToken = true) {
  const res = {
    token_type: 'Bearer',
    access_token: createAccessToken(),
    expires_in: 2 * 60 * 60 // 2h in seconds
  }
  if (withRefreshToken) {
    res['refresh_token'] = createRefreshToken();
  }
  return res;
}

function createRefreshToken() {
  return createToken({type: REFRESH_TOKEN_TYPE}, '2y');
}

function createAccessToken() {
  return createToken({type: ACCESS_TOKEN_TYPE}, '2h');
}

function createToken(payload = {}, expiresIn = '20m') {
  return jwt.sign(payload, env.key, {expiresIn});
}

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomText(size = 10) {
  let res = '';
  for (let i = 0; i < size; i++) {
    res += characters.charAt(Math.floor(characters.length * Math.random()));
  }
  return res;
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function validatePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

module.exports = {
  queryToStr,
  createCode,
  auth2Response,
  createRefreshToken,
  createAccessToken,
  createCode,
  CODE_TOKEN_TYPE,
  REFRESH_TOKEN_TYPE,
  ACCESS_TOKEN_TYPE,
  randomText,
  hashPassword,
  validatePassword,
  COMMAND_ON_OFF,
  COMMAND_START_STOP,
  DEVICE_TYPE_PETFEEDER,
  DEVICE_TYPE_OUTLET
};
