import { Router } from 'express';
import { quoteController } from './quote.controller';

const router = Router();

// GET /api/quotes/summary - 전체 시세 요약
router.get('/summary', (req, res) => quoteController.getSummary(req, res));

// GET /api/quotes/ticker - 티커 바 데이터
router.get('/ticker', (req, res) => quoteController.getTicker(req, res));

// GET /api/quotes/category/:category - 카테고리별 시세
router.get('/category/:category', (req, res) => quoteController.getByCategory(req, res));

// GET /api/quotes/:symbol - 개별 심볼 시세
router.get('/:symbol', (req, res) => quoteController.getQuote(req, res));

export { router as quoteRoutes };
