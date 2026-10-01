import request from 'supertest';

import {env} from "../src/environments";
import {closeApp, getApp} from "./utils/utils";

jest.setTimeout(1000000);

describe('Application health test', () => {
    let app: any, server: any;

    beforeAll(async () => {
        env.username = 'test';
        env.password = 'test';
        env.auth2ClientId = 'GOOGLE_CLIENT_ID';
        env.auth2ClientSecret = 'GOOGLE_CLIENT_SECRET';
        env.auth2redirectUri = 'REDIRECT_URI';
        env.googleUserId = 'AGENT_USER_ID';

        [app, server] = await getApp();
    });

    afterAll(async () => {
        await closeApp(server);
    });

    it('should return 200 OK for health check', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({status: 'OK'});
    });
});
