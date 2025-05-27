import path from "path";
import express from 'express';

const router = express.Router();

router.use('/hls', express.static(path.join(__dirname, '../../../public/stream')));

export default router;
