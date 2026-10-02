import path from 'path';

import express from 'express';

import webSocketInstance from '../../socket/web-socket';
import isLogin from '../../middlewares/is-login';

const router = express.Router();

router.use(isLogin);

router.use('/hls', express.static(path.join(__dirname, '../../../public/stream')));
router.use('/img', express.static(path.join(__dirname, '../../../public/stream')));

router.get('/:pid', (req, res) => {
  // todo: check if exist or return 404
  const deviceId = req.params.pid;
  const isStreaming = webSocketInstance.isWebSocketStreaming(deviceId);
  if (isStreaming) {
    webSocketInstance.updateLastStreamingRequest(deviceId);
  }
  res.render('stream', { deviceId, isStreaming });
});

export default router;
