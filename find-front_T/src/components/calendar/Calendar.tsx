import React, { useEffect, useState } from 'react';
import './Calendar.css';
import { CalendarHeader } from './CalendarHeader';
import { CalendarDay } from './CalendarDay';
import { EventModal } from './EventModal';
import { useCalendar } from '../../hooks/useCalendar';
import { calendarApi } from '../../services/api/calendarApi';
import { CalendarEvent, CalendarDay as CalendarDayType } from '../../types/calendar';

export const Calendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const { currentDate, days, nextMonth, prevMonth, goToToday } = useCalendar(new Date(), events);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    // Fetch events when month changes
    // In a real app, you'd pass the start/end date of the view
    const fetchEvents = async () => {
      const data = await calendarApi.getEvents(new Date(), new Date());
      setEvents(data);
    };
    fetchEvents();
  }, [currentDate]);

  const handleDayClick = (day: CalendarDayType) => {
    setSelectedDate(day.date);
    setSelectedEvents(day.events);
    setIsModalOpen(true);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-container">
      <CalendarHeader 
        currentDate={currentDate} 
        onNext={nextMonth} 
        onPrev={prevMonth} 
        onToday={goToToday}
      />
      
      <div className="calendar-grid">
        {weekDays.map(day => (
          <div key={day} className="weekday-header">{day}</div>
        ))}
        
        {days.map((day, index) => (
          <CalendarDay 
            key={index} 
            day={day} 
            onDayClick={handleDayClick}
          />
        ))}
      </div>

      <EventModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        events={selectedEvents}
      />
    </div>
  );
};
