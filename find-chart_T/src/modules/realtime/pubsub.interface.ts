/**
 * PubSub 인터페이스 (추상화 계약서)
 * 
 * 구현체가 무엇이든 (Memory, Redis, Kafka 등) 이 인터페이스만 지키면 교체 가능.
 * - 단일 서버: MemoryPubSubService (EventEmitter)
 * - 멀티 서버: RedisPubSubService (Redis Pub/Sub)
 */

import { OutboundSocketMessage } from './realtime.types';

export interface IPubSubService {
  /**
   * 메시지 발행 (Broadcast)
   * - Ingestor(데이터 수집기)가 호출
   * - 모든 구독자에게 메시지 전달
   */
  publish(message: OutboundSocketMessage): Promise<void>;

  /**
   * 메시지 수신 (Subscribe)
   * - Socket Server(방송국)가 호출
   * - 메시지를 받으면 콜백 실행
   */
  subscribe(callback: (message: OutboundSocketMessage) => void): void;
}
