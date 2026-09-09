import { 
  getDaysInMonth, 
  getFirstDayOfMonth, 
  isToday, 
  getMonthName, 
  getDayNames,
  addMonths,
  formatDateKey 
} from '../utils/date';
import type { TFunc } from '../i18n';

interface CalendarProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
  noteDates: Set<string>;
  t: TFunc;
  locale: string;
}

export function Calendar({ 
  currentMonth, 
  onMonthChange, 
  onDayClick, 
  noteDates,
  t,
  locale,
}: CalendarProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);
  const prevMonthDays = firstDayOfMonth;
  const totalCells = Math.ceil((prevMonthDays + daysInMonth) / 7) * 7;
  
  const dayNames = getDayNames(locale);
  
  const handlePrevMonth = () => {
    onMonthChange(addMonths(currentMonth, -1));
  };
  
  const handleNextMonth = () => {
    onMonthChange(addMonths(currentMonth, 1));
  };
  
  const handleToday = () => {
    onMonthChange(new Date());
  };
  
  const getDayDate = (index: number): Date => {
    const dayOfMonth = index - prevMonthDays + 1;
    return new Date(year, month, dayOfMonth);
  };
  
  const isOtherMonth = (index: number): boolean => {
    return index < prevMonthDays || index >= prevMonthDays + daysInMonth;
  };
  
  const renderDay = (index: number) => {
    const date = getDayDate(index);
    const dateKey = formatDateKey(date);
    const otherMonth = isOtherMonth(index);
    const today = isToday(date);
    const hasNote = noteDates.has(dateKey);
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (otherMonth) return;
      const grid = e.currentTarget.closest('.calendar-grid');
      if (!grid) return;
      const buttons = Array.from(grid.querySelectorAll('.calendar-day:not(.other-month)')) as HTMLButtonElement[];
      const currentIndex = buttons.indexOf(e.currentTarget);
      if (currentIndex === -1) return;
      
      let targetIndex = -1;
      switch (e.key) {
        case 'ArrowRight':
          targetIndex = currentIndex + 1;
          break;
        case 'ArrowLeft':
          targetIndex = currentIndex - 1;
          break;
        case 'ArrowDown':
          targetIndex = currentIndex + 7;
          break;
        case 'ArrowUp':
          targetIndex = currentIndex - 7;
          break;
        case 'Home':
          targetIndex = Math.floor(currentIndex / 7) * 7;
          break;
        case 'End':
          targetIndex = Math.min(Math.floor(currentIndex / 7) * 7 + 6, buttons.length - 1);
          break;
      }
      
      if (targetIndex >= 0 && targetIndex < buttons.length) {
        e.preventDefault();
        buttons[targetIndex].focus();
      }
    };
    
    return (
      <button
        key={index}
        type="button"
        className={`calendar-day ${today ? 'today' : ''} ${hasNote ? 'has-note' : ''} ${otherMonth ? 'other-month' : ''}`}
        onClick={() => !otherMonth && onDayClick(date)}
        onKeyDown={handleKeyDown}
        disabled={otherMonth}
        aria-label={`${dateKey}${hasNote ? ` (${t('hasNote')})` : ''}${today ? ` - ${t('isToday')}` : ''}`}
        aria-selected={today}
        aria-disabled={otherMonth}
      >
        <span className="calendar-day-number">{date.getDate()}</span>
        {hasNote && !otherMonth && <span className="calendar-day-indicator" aria-hidden="true" />}
      </button>
    );
  };
  
  return (
    <div className="calendar" role="region" aria-label={t('calendar')}>
      <div className="calendar-header">
        <button 
          className="calendar-nav-btn" 
          onClick={handlePrevMonth} 
          aria-label={t('prevMonth')}
          title={t('prevMonth')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        
        <span className="calendar-month-title">{getMonthName(year, month, locale)}</span>
        
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            className="calendar-nav-btn calendar-today-btn" 
            onClick={handleToday} 
            aria-label={t('goToToday')}
            title={t('goToToday')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          
          <button 
            className="calendar-nav-btn" 
            onClick={handleNextMonth} 
            aria-label={t('nextMonth')}
            title={t('nextMonth')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="calendar-weekdays" role="row" aria-label={t('calendar')}>
        {dayNames.map((day, i) => (
          <div key={i} className="calendar-day-header" role="columnheader">{day}</div>
        ))}
      </div>
      
      <div className="calendar-grid" role="grid" aria-label={`${getMonthName(year, month, locale)}`}>
        {Array.from({ length: totalCells }, (_, i) => renderDay(i))}
      </div>
      
      <div className="calendar-legend">
        <span className="legend-item">
          <span className="legend-dot today" aria-hidden="true"></span>
          {t('isToday')}
        </span>
        <span className="legend-item">
          <span className="legend-dot has-note" aria-hidden="true"></span>
          {t('hasNote')}
        </span>
      </div>
    </div>
  );
}