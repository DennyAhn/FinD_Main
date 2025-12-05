/**
 * PubSub Service Factory
 * 
 * 환경 설정에 따라 적절한 PubSub 구현체를 반환.
 * - USE_REDIS=false (default): MemoryPubSubService (단일 서버, 최고 성능)
 * - USE_REDIS=true: RedisPubSubService (멀티 서버, Scale-out)
 * 
 * 사용법:
 *   import { pubSubService } from './pubsub.factory';
 *   await pubSubService.publish(message);
 *   pubSubService.subscribe(callback);
 */

import config from '../../config';
import { IPubSubService } from './pubsub.interface';
import { MemoryPubSubService } from './memory.pubsub';
import { RedisPubSubService } from './redis.pubsub';

class PubSubFactory {
  private static instance: IPubSubService | null = null;

  static getInstance(): IPubSubService {
    if (!this.instance) {
      if (config.USE_REDIS) {
        this.instance = new RedisPubSubService();
        console.log('🔴 [PubSub] Redis Mode 활성화 (Multi-Server Scale-out)');
      } else {
        this.instance = new MemoryPubSubService();
        console.log('🚀 [PubSub] Memory Mode 활성화 (Single Server Optimized)');
      }
    }
    return this.instance;
  }
}

export const pubSubService = PubSubFactory.getInstance();
