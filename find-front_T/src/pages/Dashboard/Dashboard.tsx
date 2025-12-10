import './Dashboard.css';
import { Calendar } from '../../components/calendar/Calendar';

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* 페이지 헤더 */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Fin:D Calendar</h1>
        <p className="dashboard-subtitle">Track earnings, conferences, and economic events</p>
      </div>
      
      <div className="dashboard-content" style={{ height: 'calc(100vh - 150px)', paddingBottom: '20px' }}>
        <Calendar />
      </div>
    </div>
  );
}
