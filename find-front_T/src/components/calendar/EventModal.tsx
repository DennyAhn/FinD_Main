import React from 'react';
import { CalendarEvent } from '../../types/calendar';
import './EventModal.css';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  events: CalendarEvent[];
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, date, events }) => {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{formatDate(date)}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          {events.length === 0 ? (
            <p className="no-events">No events for this day.</p>
          ) : (
            <div className="modal-events-list">
              {events.map(event => (
                <div key={event.id} className={`modal-event-item ${event.type}`}>
                  <div className="event-time">{event.time}</div>
                  <div className="event-details">
                    <h4 className="event-title">
                      {event.companySymbol && <span className="company-symbol">{event.companySymbol}</span>}
                      {event.title}
                    </h4>
                    {event.description && <p className="event-description">{event.description}</p>}
                    <span className="event-type-tag">{event.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
