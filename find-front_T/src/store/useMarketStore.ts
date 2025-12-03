import { create } from 'zustand'

export type MarketFilter = 'ALL' | 'NASDAQ' | 'DOW' | 'SP500'

interface MarketState {
  selectedMarket: MarketFilter
  setSelectedMarket: (market: MarketFilter) => void
}

/**
 * 글로벌 증시 필터 상태 관리
 */
export const useMarketStore = create<MarketState>((set) => ({
  selectedMarket: 'ALL',
  setSelectedMarket: (market) => set({ selectedMarket: market }),
}))

