import apiClient from './client'
import type { Company } from '@/types'

export const searchApi = {
  // 기업 검색
  searchCompany: async (query: string): Promise<Company[]> => {
    const response = await apiClient.get(`/company/search/${query}`)
    return response.data
  },
}

