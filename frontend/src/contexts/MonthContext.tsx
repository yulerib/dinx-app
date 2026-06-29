import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface MonthContextType {
  currentMonth: Date;
  selectedDay: number;
  setMonth: (date: Date) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  setSelectedDay: (day: number) => void;
  nextDay: () => void;
  prevDay: () => void;
  goToToday: () => void;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

const SESSION_KEY_DAY = 'blaise_selected_day';
const SESSION_KEY_MONTH = 'blaise_selected_month';

function getInitialDay(): number {
  const today = new Date();
  const stored = sessionStorage.getItem(SESSION_KEY_DAY);
  const parsed = stored ? parseInt(stored, 10) : NaN;
  return (!isNaN(parsed) && parsed >= 1 && parsed <= 31) ? parsed : today.getDate();
}

function getInitialMonth(): Date {
  const today = new Date();
  const stored = sessionStorage.getItem(SESSION_KEY_MONTH);
  if (stored) {
    const [y, m] = stored.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      return new Date(y, m - 1, 1);
    }
  }
  return new Date(today.getFullYear(), today.getMonth(), 1);
}

export function MonthProvider({ children }: { children: ReactNode }) {
  const today = new Date();
  const [currentMonth, setMonthState] = useState<Date>(getInitialMonth);
  const [selectedDay, setSelectedDayState] = useState<number>(getInitialDay);

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const persistMonth = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    sessionStorage.setItem(SESSION_KEY_MONTH, `${y}-${m}`);
  };

  const persistDay = (day: number) => {
    sessionStorage.setItem(SESSION_KEY_DAY, String(day));
  };

  const setSelectedDay = (day: number) => {
    const safeDay = (typeof day === 'number' && !isNaN(day) && day >= 1 && day <= 31) ? day : today.getDate();
    persistDay(safeDay);
    setSelectedDayState(safeDay);
  };

  const setMonth = (newDate: Date) => {
    persistMonth(newDate);
    setMonthState(newDate);
    const maxDays = getDaysInMonth(newDate);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  };

  const nextMonth = () => {
    const nextDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setMonth(nextDate);
  };

  const prevMonth = () => {
    const prevDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setMonth(prevDate);
  };

  const nextDay = () => {
    const maxDays = getDaysInMonth(currentMonth);
    const next = Math.min(maxDays, selectedDay + 1);
    setSelectedDay(next);
  };

  const prevDay = () => {
    const prev = Math.max(1, selectedDay - 1);
    setSelectedDay(prev);
  };

  const goToToday = () => {
    const now = new Date();
    const newMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    persistMonth(newMonth);
    setMonthState(newMonth);
    setSelectedDay(now.getDate());
  };

  return (
    <MonthContext.Provider value={{ currentMonth, selectedDay, setMonth, nextMonth, prevMonth, setSelectedDay, nextDay, prevDay, goToToday }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const context = useContext(MonthContext);
  if (!context) throw new Error('useMonth must be used within MonthProvider');
  // Garantia extra: nunca retorna selectedDay undefined
  return {
    ...context,
    selectedDay: (typeof context.selectedDay === 'number' && !isNaN(context.selectedDay))
      ? context.selectedDay
      : new Date().getDate()
  };
}
