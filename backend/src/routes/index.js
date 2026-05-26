import { Router } from 'express';
import studyRoutes from './study.routes.js';
import * as studyController from '../controllers/study.controller.js';
import * as debugController from '../controllers/debug.controller.js';

const router = Router();

router.get('/health', studyController.health);
router.get('/debug/llm', debugController.testLlm);
router.use('/study', studyRoutes);

export default router;
