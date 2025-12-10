import { useState, useMemo } from 'react';
import { CalendarDay, CalendarEvent } from '../types/calendar';

export const useCalendar = (initialDate: Date = new Date(), events: CalendarEvent[] = []) => {
  const [currentDate, setCurrentDate] = useState(initialDate);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    // Last day of the month
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Day of week for the first day (0 = Sunday, 6 = Saturday)
    const startDayOfWeek = firstDayOfMonth.getDay();

    const calendarDays: CalendarDay[] = [];

    // Previous month's days
    for (let i = 0; i < startDayOfWeek; i++) {
      const date = new Date(year, month, -startDayOfWeek + 1 + i);
      calendarDays.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDate(date, new Date()),
        events: getEventsForDate(date, events),
      });
    }

    // Current month's days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const date = new Date(year, month, i);
      calendarDays.push({
        date,
        isCurrentMonth: true,
        isToday: isSameDate(date, new Date()),
        events: getEventsForDate(date, events),
      });
    }

    // Next month's days to fill the grid (assuming 6 rows of 7 days = 42 cells usually, or just fill week)
    const remainingDays = 42 - calendarDays.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      calendarDays.push({
        date,
        isCurrentMonth: false,
        isToday: isSameDate(date, new Date()),
        events: getEventsForDate(date, events),
      });
    }

    return calendarDays;
  }, [currentDate, events]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return {
    currentDate,
    days,
    nextMonth,
    prevMonth,
    goToToday,
    setCurrentDate
  };
};

// Helper functions
function isSameDate(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getEventsForDate(date: Date, events: CalendarEvent[]) {
  return events.filter(event => isSameDate(event.date, date));
}
