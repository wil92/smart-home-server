import request from 'supertest';
import url from 'url';
import jwt from 'jsonwebtoken';

import {env} from '../src/environments';
import {createAccessToken, createRefreshToken, createCode} from "../src/utils";
import {getApp, closeApp, cleanDevicesInDb} from './utils/utils';

jest.setTimeout(10000)

describe('Functions test', () => {
  let app: any, server: any;

  beforeAll(async () => {
    env.username = 'test';
    env.password = 'test';
    env.auth2ClientId = 'GOOGLE_CLIENT_ID';
    env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
    env.auth2redirectUri = 'REDIRECT_URI';

    [app, server] = await getApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  it('should get login and redirected to home', async () => {
    const res = await request(app).post('/auth')
        .expect(302)
        .send({username: 'test', password: 'test'});
    expect(res.headers.location).toEqual('/');
  });

  it('should get login and redirected to home', async () => {
    const res = await request(app).post('/auth/token')
        .expect(200)
        .send({
          grant_type: 'basic',
          username: 'test',
          password: 'test'
        });

    expect(res.body['token_type']).toEqual('Bearer');
    expect(res.body['expires_in']).toEqual(7200);// 2h
    jwt.verify(res.body['access_token'], env.key);
    jwt.verify(res.body['refresh_token'], env.key);
  });

  it('should test all the auth2 process', async () => {
    // Authenticate and get redirected to google
    const res = await request(app).post('/auth?client_id=GOOGLE_CLIENT_ID&redirect_uri=REDIRECT_URI&state=STATE_STRING&scope=REQUESTED_SCOPES&response_type=code')
      .expect(302)
      .send({username: 'test', password: 'test'});
    expect(res.headers.location.startsWith('REDIRECT_URI')).toBeTruthy();
    const urlObj = url.parse(res.headers.location, true);
    expect(urlObj.query.state).toEqual('STATE_STRING');
    expect(urlObj.query.code).toBeTruthy();
    jwt.verify(urlObj.query.code as string, env.key);

    // Get refresh token with the authorization code
    const res2 = await request(app).post('/auth/token')
      .expect(200)
      .send({
        client_id: 'GOOGLE_CLIENT_ID',
        client_secret: 'GOOGLE_CLIENT_SECRET',
        grant_type: 'authorization_code',
        code: encodeURI(urlObj.query.code as string),
        redirect_uri: 'REDIRECT_URI'
      });
    expect(res2.body['token_type']).toEqual('Bearer');
    expect(res2.body['expires_in']).toEqual(7200);// 2h
    jwt.verify(res2.body['access_token'], env.key);
    jwt.verify(res2.body['refresh_token'], env.key);

    // Get refresh token with the authorization code
    const res3 = await request(app).post('/auth/token')
      .expect(200)
      .send({
        client_id: 'GOOGLE_CLIENT_ID',
        client_secret: 'GOOGLE_CLIENT_SECRET',
        grant_type: 'refresh_token',
        refresh_token: encodeURI(res2.body['refresh_token'])
      });
    expect(res3.body['token_type']).toEqual('Bearer');
    expect(res3.body['expires_in']).toEqual(7200);// 2h
    jwt.verify(res3.body['access_token'], env.key);
  });

  it('should get and exception if an access_token is used as a refresh_token', async () => {
    const accessToken = createAccessToken();
    await request(app).post(`/auth/token?client_id=GOOGLE_CLIENT_ID&client_secret=GOOGLE_CLIENT_SECRET&grant_type=refresh_token&refresh_token=${encodeURI(accessToken)}`)
      .expect(400);
  });

  it('should get and exception if an access_token is used as an authorization_code', async () => {
    const accessToken = createAccessToken();
    await request(app).post(`/auth/token?client_id=GOOGLE_CLIENT_ID&client_secret=GOOGLE_CLIENT_SECRET&grant_type=authorization_code&code=${encodeURI(accessToken)}&redirect_uri=REDIRECT_URI`)
      .expect(400);
  });

  it('should get and exception if a refresh_token is used as an authorization_code', async () => {
    const refreshToken = createRefreshToken();
    await request(app).post(`/auth/token?client_id=GOOGLE_CLIENT_ID&client_secret=GOOGLE_CLIENT_SECRET&grant_type=authorization_code&code=${encodeURI(refreshToken)}&redirect_uri=REDIRECT_URI`)
      .expect(400);
  });

  it('should get and exception if an authorization_code is used as a refresh_token', async () => {
    const code = createCode();
    await request(app).post(`/auth/token?client_id=GOOGLE_CLIENT_ID&client_secret=GOOGLE_CLIENT_SECRET&grant_type=refresh_token&refresh_token=${encodeURI(code)}`)
      .expect(400);
  });
});
