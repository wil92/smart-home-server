import express from 'express';
const router = express.Router();

import isLogin from '../middlewares/is-login';
import { models } from '../models';
import wepSocketInstance from '../socket/web-socket';

router.use(isLogin);

// GET home page
router.get('/', async (_req, res, _next) => {
  let devices = (await models.Device.find({})) as unknown as any;
  devices = devices.map((d: any) => {
    return {
      ...d.toJSON(),
      online: wepSocketInstance.connectedDevices.has(d.did)
    };
  });
  res.render('index', { devices });
});

// GET policy page
router.get('/policy', function (_req, res, _next) {
  res.render('policy.ejs', { title: 'Policy' });
});

export default router;
