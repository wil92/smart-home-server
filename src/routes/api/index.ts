import express from 'express';
import devicesRouter from './devices';
import validateToken from "../../middlewares/validate-token";

const router = express.Router();

router.use(validateToken);
router.use('/lights', devicesRouter); // deprecated
router.use('/devices', devicesRouter);

export default router;
