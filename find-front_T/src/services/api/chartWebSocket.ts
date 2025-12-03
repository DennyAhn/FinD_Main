import type { WSMessage } from '@/types/candle';

type TickCallback = (data: WSMessage) => void;

const WS_URL = (import.meta.env.VITE_CHART_WS_URL || 'ws://localhost:8080').replace(/\/$/, '') + '/ws';

class ChartWebSocket {
  private static instance: ChartWebSocket;
  private ws: WebSocket | null = null;
  private subscribers: Set<TickCallback> = new Set();
  private isConnected = false;

  private constructor() {
    this.connect();
  }

  public static getInstance(): ChartWebSocket {
    if (!ChartWebSocket.instance) {
      ChartWebSocket.instance = new ChartWebSocket();
    }
    return ChartWebSocket.instance;
  }

  public subscribe(callback: TickCallback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  public getConnectionStatus() {
    return this.isConnected;
  }

  private connect() {
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('WebSocket Connected');
      this.isConnected = true;
      this.subscribers.forEach(callback => callback({ type: 'reconnected' }));
    };

    this.ws.onclose = () => {
      console.log('WebSocket Disconnected');
      this.isConnected = false;
      setTimeout(() => this.connect(), 5000);
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.handleMessage(event.data);
      }
    };
  }

  private handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      this.subscribers.forEach(callback => callback(msg));
    } catch (err) {
      console.error('WS parse error', err);
    }
  }
}

export const chartWebSocket = ChartWebSocket.getInstance();
