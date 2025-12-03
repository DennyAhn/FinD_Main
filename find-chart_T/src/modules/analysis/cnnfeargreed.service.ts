/**
 * CNN Fear & Greed Index API 연동 (주식 시장용)
 * S&P 500 기반 공포탐욕 지수
 * 
 * 개선사항:
 * - 'any' 타입 제거 및 명시적 인터페이스 정의
 * - API 응답 구조 변경에 대비한 안전한 파싱 로직
 */

import { logger } from '../../shared/utils/logger';

export interface CNNFearGreedData {
  value: number;                    // 0-100
  classification: string;           // extreme fear, fear, neutral, greed, extreme greed
  classificationKo: string;         // 한글 분류
  timestamp: string;                // ISO 날짜
  previousClose: number;            // 전일 종가
  previous1Week: number;            // 1주 전
  previous1Month: number;           // 1달 전
  previous1Year: number;            // 1년 전
}

// 외부 API 응답 타입 정의 (Internal Use)
interface CNNResponse {
  fear_and_greed?: {
    score?: number;
    rating?: string;
    timestamp?: string;
    previous_close?: number;
    previous_1_week?: number;
    previous_1_month?: number;
    previous_1_year?: number;
  };
}

// 분류 한글 변환
const CLASSIFICATION_KO: Record<string, string> = {
  'extreme fear': '극단적 공포',
  'fear': '공포',
  'neutral': '중립',
  'greed': '탐욕',
  'extreme greed': '극단적 탐욕',
};

// 값으로 분류 결정
function getClassification(value: number): string {
  if (value <= 25) return 'extreme fear';
  if (value <= 45) return 'fear';
  if (value <= 55) return 'neutral';
  if (value <= 75) return 'greed';
  return 'extreme greed';
}

class CNNFearGreedService {
  private readonly API_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  private cache: { data: CNNFearGreedData | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

  /**
   * CNN Fear & Greed Index 조회
   */
  async getCurrent(): Promise<CNNFearGreedData> {
    const now = Date.now();
    
    // 캐시가 유효하면 반환
    if (this.cache.data && now - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const response = await fetch(this.API_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://edition.cnn.com/',
        },
      });
      
      if (!response.ok) {
        throw new Error(`CNN Fear & Greed API error: ${response.status}`);
      }

      const json = await response.json() as CNNResponse;
      const data = this.parseResponse(json);
      
      // 캐시 업데이트
      this.cache = { data, timestamp: now };
      
      return data;
    } catch (error) {
      // 캐시가 있으면 오래됐어도 반환
      if (this.cache.data) {
        logger.warn('CNN Fear & Greed API failed, using stale cache');
        return this.cache.data;
      }
      throw error;
    }
  }

  /**
   * API 응답 파싱 (Safe Parsing)
   */
  private parseResponse(json: CNNResponse): CNNFearGreedData {
    const fg = json.fear_and_greed;
    
    // 데이터 유효성 검사 (Guard Clause)
    if (!fg || typeof fg.score !== 'number') {
      throw new Error('Invalid CNN Fear & Greed data format');
    }

    const value = Math.round(fg.score);
    // API가 등급을 주지 않으면 점수로 계산
    const classification = fg.rating ? fg.rating.toLowerCase() : getClassification(value);
    
    return {
      value,
      classification,
      classificationKo: CLASSIFICATION_KO[classification] || classification,
      timestamp: fg.timestamp || new Date().toISOString(),
      previousClose: fg.previous_close ?? 0,
      previous1Week: fg.previous_1_week ?? 0,
      previous1Month: fg.previous_1_month ?? 0,
      previous1Year: fg.previous_1_year ?? 0,
    };
  }
}

export const cnnFearGreedService = new CNNFearGreedService();
