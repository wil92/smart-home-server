import request from 'supertest';

import {env} from '../src/environments';
import {models} from '../src/models';
import {getApp, closeApp, createBasicAuth, cleanDevicesInDb} from './utils/utils';

describe('Devices API', () => {
    let app: any;
    let server: any;
    const deviceIds = [
        `devices-test-${Date.now()}-1`,
        `devices-test-${Date.now()}-2`,
    ];

    beforeAll(async () => {
        env.username = 'test';
        env.password = 'test';
        [app, server] = await getApp();
    });

    afterAll(async () => {
        await closeApp(server);
    });

    beforeEach(async () => {
        await cleanDevicesInDb({did: {$in: deviceIds}});
    });

    afterEach(async () => {
        await cleanDevicesInDb({did: {$in: deviceIds}});
    });

    async function insertDevices() {
        return models.Device.create([
            {
                did: deviceIds[0],
                type: 'action.devices.types.OUTLET',
                name: {name: 'Test outlet'},
                params: {on: true, isRunning: false},
            },
            {
                did: deviceIds[1],
                type: 'action.devices.types.PETFEEDER',
                name: {name: 'Test feeder'},
                params: {on: false, isRunning: true},
            },
        ]);
    }

    it('requires an access token to list devices', async () => {
        await request(app).get('/api/devices').expect(401);
    });

    it('lists persisted devices', async () => {
        await insertDevices();

        const res = await request(app).get('/api/devices')
            .set('Authorization', createBasicAuth())
            .expect(200);

        expect(res.body).toEqual(expect.arrayContaining([
            expect.objectContaining({
                did: deviceIds[0],
                type: 'action.devices.types.OUTLET',
                name: expect.objectContaining({name: 'Test outlet'}),
                params: expect.objectContaining({on: true, isRunning: false}),
                online: false,
            }),
            expect.objectContaining({
                did: deviceIds[1],
                type: 'action.devices.types.PETFEEDER',
                name: expect.objectContaining({name: 'Test feeder'}),
                params: expect.objectContaining({on: false, isRunning: true}),
                online: false,
            }),
        ]));

        const storedDevices = await models.Device.find({did: {$in: deviceIds}});
        expect(storedDevices).toHaveLength(2);
    });

    it('gets a device by id and returns 404 for an unknown id', async () => {
        await insertDevices();

        const res = await request(app).get(`/api/devices/${deviceIds[0]}`)
            .set('Authorization', createBasicAuth())
            .expect(200);

        expect(res.body).toMatchObject({
            did: deviceIds[0],
            type: 'action.devices.types.OUTLET',
            name: {name: 'Test outlet'},
            params: {on: true, isRunning: false},
            online: false,
        });

        await request(app).get('/api/devices/unknown-device')
            .set('Authorization', createBasicAuth())
            .expect(404, {error: 'Device not found'});

        expect(await models.Device.findOne({did: deviceIds[0]})).not.toBeNull();
    });

    it('deletes a device and confirms it is removed from the database', async () => {
        await insertDevices();

        await request(app).delete(`/api/devices/${deviceIds[0]}`)
            .set('Authorization', createBasicAuth())
            .expect(200);

        expect(await models.Device.findOne({did: deviceIds[0]})).toBeNull();
        expect(await models.Device.findOne({did: deviceIds[1]})).not.toBeNull();

        await request(app).get(`/api/devices/${deviceIds[0]}`)
            .set('Authorization', createBasicAuth())
            .expect(404, {error: 'Device not found'});
    });

    it('does not remove another device when deleting an unknown id', async () => {
        await insertDevices();

        await request(app).delete('/api/devices/unknown-device')
            .set('Authorization', createBasicAuth())
            .expect(200);

        expect(await models.Device.find({did: {$in: deviceIds}})).toHaveLength(2);
    });
});