/**
 * Alternative.me Crypto Fear & Greed Index API 연동
 * https://alternative.me/crypto/fear-and-greed-index/
 * 
 * 개선사항:
 * - 'any' 타입 제거 및 명시적 인터페이스 정의
 * - API 응답 구조 변경에 대비한 안전한 파싱 로직
 */

import { logger } from '../../shared/utils/logger';

export interface FearGreedData {
  value: number;                    // 0-100
  classification: string;           // Extreme Fear, Fear, Neutral, Greed, Extreme Greed
  classificationKo: string;         // 한글 분류
  timestamp: string;                // ISO 날짜
  timeUntilUpdate: number;          // 다음 업데이트까지 초
}

export interface FearGreedHistoryItem {
  value: number;
  classification: string;
  date: string;
}

export interface FearGreedResponse {
  current: FearGreedData;
  history?: FearGreedHistoryItem[] | undefined;
}

// 외부 API 응답 타입 정의 (Internal Use)
interface AlternativeMeResponse {
  metadata?: {
    error?: string;
  };
  data?: AlternativeMeDataItem[];
}

interface AlternativeMeDataItem {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}

// 분류 한글 변환
const CLASSIFICATION_KO: Record<string, string> = {
  'Extreme Fear': '극단적 공포',
  'Fear': '공포',
  'Neutral': '중립',
  'Greed': '탐욕',
  'Extreme Greed': '극단적 탐욕',
};

class FearGreedService {
  private readonly API_URL = 'https://api.alternative.me/fng/';
  private cache: { data: FearGreedResponse | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

  /**
   * 현재 Fear & Greed Index 조회
   */
  async getCurrent(): Promise<FearGreedData> {
    const response = await this.fetchWithCache(1);
    return response.current;
  }

  /**
   * Fear & Greed Index + 히스토리 조회
   * @param days 히스토리 일수 (기본 7일)
   */
  async getWithHistory(days: number = 7): Promise<FearGreedResponse> {
    return this.fetchWithCache(days);
  }

  /**
   * API 호출 (캐시 적용)
   */
  private async fetchWithCache(limit: number): Promise<FearGreedResponse> {
    const now = Date.now();
    
    // 캐시가 유효하면 반환
    if (this.cache.data && now - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const response = await fetch(`${this.API_URL}?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Fear & Greed API error: ${response.status}`);
      }

      const json = await response.json() as AlternativeMeResponse;
      
      if (json.metadata?.error) {
        throw new Error(`Fear & Greed API error: ${json.metadata.error}`);
      }

      const data = this.parseResponse(json);
      
      // 캐시 업데이트
      this.cache = { data, timestamp: now };
      
      return data;
    } catch (error) {
      // 캐시가 있으면 오래됐어도 반환
      if (this.cache.data) {
        logger.warn('Fear & Greed API failed, using stale cache');
        return this.cache.data;
      }
      throw error;
    }
  }

  /**
   * API 응답 파싱 (Safe Parsing)
   */
  private parseResponse(json: AlternativeMeResponse): FearGreedResponse {
    const dataArray = json.data ?? [];
    
    if (dataArray.length === 0) {
      throw new Error('No Fear & Greed data available');
    }

    const latest = dataArray[0];
    if (!latest) {
      throw new Error('Invalid Fear & Greed data format');
    }

    const current: FearGreedData = {
      value: parseInt(latest.value, 10),
      classification: latest.value_classification,
      classificationKo: CLASSIFICATION_KO[latest.value_classification] || latest.value_classification,
      timestamp: new Date(parseInt(latest.timestamp, 10) * 1000).toISOString(),
      timeUntilUpdate: parseInt(latest.time_until_update ?? '0', 10),
    };

    // 히스토리 (첫 번째 제외)
    const history: FearGreedHistoryItem[] = dataArray.slice(1).map((item: AlternativeMeDataItem) => ({
      value: parseInt(item.value, 10),
      classification: item.value_classification,
      date: new Date(parseInt(item.timestamp, 10) * 1000).toISOString().split('T')[0] ?? '',
    }));

    // history가 있을 때만 포함
    if (history.length > 0) {
      return { current, history };
    }
    return { current };
  }
}

export const fearGreedService = new FearGreedService();
