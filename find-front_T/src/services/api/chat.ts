import apiClient from './client'
import type { ChatMessage } from '@/types'

export const chatApi = {
  // AI 채팅 메시지 전송
  // AI 채팅 메시지 전송
  sendMessage: async (message: string): Promise<{ response: string; widgets?: any[] }> => {
    const response = await apiClient.post('/agent/chat', { message })
    return response.data
  },

  // 채팅 히스토리 조회
  getHistory: async (limit: number = 50): Promise<ChatMessage[]> => {
    const response = await apiClient.get('/agent/history', {
      params: { limit },
    })
    return response.data
  },
}

