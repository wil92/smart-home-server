const request = require('supertest');
const env = require('../src/environments')
const {createAccessToken, createRefreshToken} = require("../src/utils");

describe('Functions test', () => {
  let app;

  beforeAll(() => {
    app = require('../app');

    env.username = 'test';
    env.password = 'test';
    env.auth2ClientId = 'GOOGLE_CLIENT_ID';
    env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
    env.auth2redirectUri = 'REDIRECT_URI';
  });

  it('should get 401 if the request did not have and access_token', async () => {
    await request(app).post('/api/lights')
      .expect(401);
  });

  it('should get 401 if the access_token is invalid', async () => {
    await request(app).post('/api/lights')
      .set('Authorization', 'Bearer invalid_access_token')
      .expect(401);
  });

  it('should get 401 if is use a token different to the access_token', async () => {
    const token = createRefreshToken();
    await request(app).post('/api/lights')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('should get the list of lights if the token is correct', async () => {
    const token = createAccessToken();
    const res = await request(app).get('/api/lights')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toEqual(0);
  });

});
