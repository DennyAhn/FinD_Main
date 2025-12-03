/**
 * WebSocket Service
 * 
 * PubSub 인터페이스를 통해 메시지를 수신하고 클라이언트에게 브로드캐스트.
 * - 구현체가 Memory든 Redis든 상관없이 동일하게 동작
 * - 추후 Redis로 교체 시 이 파일 수정 불필요
 */

import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import { pubSubService } from './pubsub.factory';
import { OutboundSocketMessage } from './realtime.types';

let wss: WebSocketServer | undefined;

/**
 * WebSocket 서버 초기화 (프론트엔드 클라이언트용)
 */
export function initWebSocketServer(httpServer: http.Server): void {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[Frontend] 클라이언트가 WebSocket으로 연결되었습니다.');

    ws.on('message', (message) => {
      // TODO: 구독 요청 처리 (특정 심볼만 구독)
      console.log('수신 메시지:', message.toString());
    });

    ws.on('close', () => {
      console.log('[Frontend] 클라이언트 연결이 끊어졌습니다.');
    });

    ws.on('error', (err) => {
      console.error('[Frontend] WebSocket 오류:', err);
    });
  });

  // ✅ PubSub 구독: 메시지가 오면 로컬 클라이언트에게 브로드캐스트
  pubSubService.subscribe((message) => {
    broadcastLocal(message);
  });
}

/**
 * 로컬 WebSocket 클라이언트에게만 메시지 전송
 * (이 서버에 직접 연결된 클라이언트만)
 */
function broadcastLocal(message: OutboundSocketMessage): void {
  if (!wss) return;
  
  const data = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/**
 * 외부에서 호출하는 브로드캐스트 함수
 * - PubSub을 통해 발행하면 모든 서버(현재는 단일)가 수신
 */
export function broadcast(message: OutboundSocketMessage): void {
  pubSubService.publish(message).catch((err) => {
    console.error('❌ [WebSocket] 브로드캐스트 실패:', err);
  });
}

/**
 * 연결된 클라이언트 수 반환
 */
export function getClientCount(): number {
  return wss?.clients.size ?? 0;
}
