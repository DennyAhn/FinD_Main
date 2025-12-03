/**
 * Redis PubSub 구현체 (멀티 서버용)
 * 
 * Redis Pub/Sub을 통해 여러 서버 간 메시지 동기화.
 * - 서버가 N대로 늘어나도 모든 클라이언트가 동일한 데이터 수신
 * - ioredis 패키지 필요: npm install ioredis
 * 
 * 활성화: USE_REDIS=true 환경변수 설정
 */

import Redis from 'ioredis';
import config from '../../config';
import { IPubSubService } from './pubsub.interface';
import { OutboundSocketMessage } from './realtime.types';

export class RedisPubSubService implements IPubSubService {
  private publisher: Redis;
  private subscriber: Redis;
  private readonly CHANNEL = 'market_stream';

  constructor() {
    // Redis 연결 설정 (재연결 전략 포함)
    const redisOptions = {
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    };

    // 발행용과 구독용 클라이언트 분리 (Redis Pub/Sub 필수 사항)
    // - 구독 모드에 들어간 클라이언트는 다른 명령 실행 불가
    this.publisher = new Redis(config.REDIS_URL, redisOptions);
    this.subscriber = new Redis(config.REDIS_URL, redisOptions);

    // 연결 이벤트 로깅
    this.publisher.on('connect', () => {
      console.log('✅ [RedisPubSub] Publisher 연결 성공');
    });
    this.publisher.on('error', (err) => {
      console.error('❌ [RedisPubSub] Publisher 오류:', err.message);
    });

    this.subscriber.on('connect', () => {
      console.log('✅ [RedisPubSub] Subscriber 연결 성공');
    });
    this.subscriber.on('error', (err) => {
      console.error('❌ [RedisPubSub] Subscriber 오류:', err.message);
    });

    console.log('🔴 [RedisPubSub] 인스턴스 생성 (Multi-Server Mode)');
  }

  /**
   * 메시지 발행 (Redis 채널로 전송)
   */
  async publish(message: OutboundSocketMessage): Promise<void> {
    try {
      const payload = JSON.stringify(message);
      await this.publisher.publish(this.CHANNEL, payload);
    } catch (error) {
      console.error('❌ [RedisPubSub] 발행 실패:', error);
      // 발행 실패해도 서버는 계속 동작해야 함 (throw 하지 않음)
    }
  }

  /**
   * 메시지 구독 (Redis 채널에서 수신)
   */
  subscribe(callback: (message: OutboundSocketMessage) => void): void {
    // 1. Redis 채널 구독
    this.subscriber.subscribe(this.CHANNEL, (err, count) => {
      if (err) {
        console.error('❌ [RedisPubSub] 구독 실패:', err);
      } else {
        console.log(`✅ [RedisPubSub] Redis 채널 구독 완료 (활성 구독: ${count}개)`);
      }
    });

    // 2. 메시지 수신 이벤트 처리
    this.subscriber.on('message', (channel, text) => {
      if (channel === this.CHANNEL) {
        try {
          const message = JSON.parse(text) as OutboundSocketMessage;
          callback(message);
        } catch (error) {
          console.error('❌ [RedisPubSub] 메시지 파싱 실패:', error);
        }
      }
    });
  }

  /**
   * 연결 종료 (Graceful Shutdown용)
   */
  async disconnect(): Promise<void> {
    await this.subscriber.unsubscribe(this.CHANNEL);
    this.publisher.disconnect();
    this.subscriber.disconnect();
    console.log('👋 [RedisPubSub] 연결 종료');
  }
}
