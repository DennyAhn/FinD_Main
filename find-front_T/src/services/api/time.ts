import apiClient from './client'

export interface ServerTimeResponse {
  timestamp: number // 밀리초 단위
  iso: string
  utc: number
}

export const timeApi = {
  /**
   * 서버의 현재 시간을 가져옵니다.
   * 클라이언트와 서버 시간 동기화에 사용됩니다.
   */
  getServerTime: async (): Promise<ServerTimeResponse> => {
    const response = await apiClient.get('/market/server-time')
    return response.data
  },
}

