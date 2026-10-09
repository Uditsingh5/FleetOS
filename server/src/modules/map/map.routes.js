import { Router } from 'express';
import { proxyMapTile } from './map.controller.js';

const router = Router();

router.get('/tiles/:z/:x/:y.png', proxyMapTile);
router.get('/tiles/:z/:x/:y', proxyMapTile);

export default router;
