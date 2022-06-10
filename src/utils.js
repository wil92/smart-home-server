const jwt = require('jsonwebtoken');
const env = require('./environments');

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
  return createToken();
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
  return createToken('2y');
}

function createAccessToken() {
  return createToken('2h');
}

function createToken(expiresIn = '20m') {
  return jwt.sign({}, env.key, {expiresIn});
}

module.exports = {queryToStr, createCode, auth2Response};
