import { Router } from 'express';

// Candle 모듈
import { candleRoutes, aggregateRoutes } from '../modules/candle';

// Analysis 모듈
import { analysisRoutes } from '../modules/analysis';

// User 모듈
import { userRoutes } from '../modules/user';

// Summary 모듈
import { summaryRoutes } from '../modules/summary';

// Quote 모듈
import { quoteRoutes } from '../modules/quote';

const router = Router();

// 캔들 데이터 API
router.use('/candles', candleRoutes);
router.use('/aggregate', aggregateRoutes);

// 기술적 분석 API
router.use('/analysis', analysisRoutes);

// 유저 API
router.use('/users', userRoutes);

// Summary API (전일 종가 등)
router.use('/summary', summaryRoutes);

// Quote API (시세 조회)
router.use('/quotes', quoteRoutes);

export default router;