import { create } from 'zustand';

interface ChartSettingsState {
  timeframe: string;
  actions: {
    setTimeframe: (timeframe: string) => void;
  };
}

export const useChartStore = create<ChartSettingsState>((set) => ({
  timeframe: '1m',
  actions: {
    setTimeframe: (timeframe) => set({ timeframe }),
  },
}));

export const useChartActions = () => useChartStore((state) => state.actions);
