const express = require('express');
const jwt = require('jsonwebtoken');

const {
  queryToStr,
  createCode,
  auth2Response,
  CODE_TOKEN_TYPE,
  REFRESH_TOKEN_TYPE,
  validatePassword
} = require("../utils");
const env = require('../environments');
const {models} = require('../models');

const router = express.Router();

router.get('/', async (req, res, next) => {
  res.render('login', {title: 'LogIn', query: queryToStr(req.query), error: null});
});

async function checkCredentials(username, password) {
  const user = await models.User.findOne({username});
  if (!!user) {
    return await validatePassword(password, user.password);
  }
  return false;
}

router.post('/', async (req, res, next) => {
  const {username, password} = req.body;
  let isValidPassword = await checkCredentials(username, password);
  if (!isValidPassword) {
    res.status(401);
    return res.render('login', {
      title: 'LogIn',
      query: queryToStr(req.query),
      error: 'Password or Username incorrect'
    });
  }
  const {client_id, redirect_uri, state} = req.query;
  if (redirect_uri) {
    if (client_id === env.auth2ClientId && redirect_uri === env.auth2redirectUri) {
      const code = createCode();
      req.session['isLogin'] = true;
      return res.redirect(`${redirect_uri}?${queryToStr({code, state})}`);
    } else {
      res.render('login', {
        title: 'LogIn',
        query: queryToStr(req.query),
        error: 'Error with Auth2 authentication'
      });
    }
  } else {
    req.session['isLogin'] = true;
    res.redirect('/');
  }
});

router.post('/token', async (req, res) => {
  const {client_id, client_secret, grant_type, code, refresh_token, username, password} = req.body;
  if ((client_id !== env.auth2ClientId || client_secret !== env.auth2ClientSecret) && grant_type !== 'basic') {
    return sendError(res);
  }
  if (grant_type === 'authorization_code' || grant_type === 'refresh_token') {
    const token = grant_type === 'authorization_code' ? code : refresh_token;
    try {
      const payload = jwt.verify(token, env.key);
      if ((grant_type === 'authorization_code' && payload.type !== CODE_TOKEN_TYPE) ||
        (grant_type === 'refresh_token' && payload.type !== REFRESH_TOKEN_TYPE)) {
        throw new Error('Invalid token');
      }
      return res.send(auth2Response(grant_type === 'authorization_code'));
    } catch (e) {
      console.error(e);
      return sendError(res);
    }
  } else if (grant_type === 'basic') {
    let isValidPassword = await checkCredentials(username, password);
    if (isValidPassword) {
      return res.send(auth2Response(true));
    }
  }
  return sendError(res);
});

function sendError(res) {
  res.status(400);
  return res.send({error: 'invalid_grant'});
}

router.get('/logout', (req, res) => {
  req.session['isLogin'] = false;
  res.redirect('/auth');
});

module.exports = router;
