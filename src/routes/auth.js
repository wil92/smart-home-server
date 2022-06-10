const express = require('express');
const data = require("../data");
const jwt = require('jsonwebtoken');
const {queryToStr, createCode, auth2Response} = require("../utils");
const router = express.Router();
const env = require('../environments')

router.get('/', (req, res, next) => {
  res.render('login', {title: 'LogIn', data, query: queryToStr(req.query), error: null});
});

router.post('/', (req, res, next) => {
  const {username, password} = req.body;
  if (env.username !== username || env.password !== password) {
    return res.render('login', {
      title: 'LogIn',
      data,
      query: queryToStr(req.query),
      error: 'Password or Username incorrect'
    });
  }
  const {client_id, redirect_uri, state} = req.query;
  if (redirect_uri) {
    if (client_id === env.auth2ClientId && redirect_uri === env.auth2redirectUri) {
      const code = createCode();
      return res.redirect(`${redirect_uri}?${queryToStr({code, state})}`);
    } else {
      res.render('login', {
        title: 'LogIn',
        data,
        query: queryToStr(req.query),
        error: 'Error with Auth2 authentication'
      });
    }
  } else {
    res.redirect('/');
  }
  req.session['isLogin'] = true;
});

router.post('/token', (req, res) => {
  const {client_id, client_secret, grant_type, code, refresh_token} = req.query;
  if (client_id !== env.auth2ClientId || client_secret !== env.auth2ClientSecret) {
    return sendError(res);
  }
  if (grant_type === 'authorization_code' || grant_type === 'refresh_token') {
    const token = grant_type === 'authorization_code' ? code : refresh_token;
    try {
      jwt.verify(token, env.key);
      return res.send(auth2Response(grant_type === 'authorization_code'));
    } catch (e) {
      console.error(e);
      return sendError(res);
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
