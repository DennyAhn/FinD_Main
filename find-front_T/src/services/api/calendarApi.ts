import { CalendarEvent } from '../../types/calendar';

// Mock data for now
const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    title: 'Oracle (ORCL) 실적발표',
    date: new Date(2025, 11, 10),
    type: 'earnings',
    time: '장 마감 후',
    companySymbol: 'ORCL',
    description: '클라우드 인프라 성장세 및 AI 데이터센터 수요'
  },
  {
    id: '5',
    title: 'Fed 금리 결정',
    date: new Date(2025, 11, 11),
    type: 'economic',
    time: '04:00 AM',
    description: 'FOMC 기준금리 발표'
  },
  {
    id: '6',
    title: 'Micron (MU) 실적발표',
    date: new Date(2025, 11, 17),
    type: 'earnings',
    time: '장 마감 후',
    companySymbol: 'MU',
    description: '메모리 반도체(HBM) 업황 및 AI 수요 전망'
  },
  {
    id: '7',
    title: 'Accenture (ACN) 실적발표',
    date: new Date(2025, 11, 18),
    type: 'earnings',
    time: '장 시작 전',
    companySymbol: 'ACN',
    description: '글로벌 IT 컨설팅 수요 및 기업 AI 도입 현황'
  }
];

export const calendarApi = {
  getEvents: async (startDate: Date, endDate: Date): Promise<CalendarEvent[]> => {
    // Simulate API call
    // For prototype: Log the requested range but return ALL mock events
    // This ensures events show up regardless of the view range passed by the component
    console.log('Fetching events range:', startDate, endDate); 
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_EVENTS);
      }, 500);
    });
  }
};
