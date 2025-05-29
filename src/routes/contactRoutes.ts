import { Router } from 'express';
import { identify } from '../controllers/contactController';

const router = Router();

router.post('/identify', identify);

export default router;