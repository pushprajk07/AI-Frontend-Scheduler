import React, { useState } from 'react';
import { Appointment } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
    appointments: Appointment[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ appointments }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const getAppointmentsForDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return appointments.filter(app => app.date === dateStr);
    };

    const days = [];
    // Padding for start of month
    for (let i = 0; i < startDay; i++) {
        days.push(
            <div
                key={`empty-${i}`}
                className='h-24 md:h-32 border border-white/5 bg-white/[0.02]'
            ></div>
        );
    }

    // Actual days
    for (let day = 1; day <= totalDays; day++) {
        const dayAppointments = getAppointmentsForDay(day);
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

        days.push(
            <div
                key={day}
                className={`h-24 md:h-32 border border-white/5 p-2 overflow-y-auto hover:bg-white/5 transition-all group ${isToday ? 'bg-blue-500/5' : 'bg-transparent'}`}
            >
                <div className='flex justify-between items-center mb-2'>
                    <span
                        className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 group-hover:text-white'}`}
                    >
                        {day}
                    </span>
                    {dayAppointments.length > 0 && (
                        <span className='text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-md font-black border border-purple-500/20'>
                            {dayAppointments.length}
                        </span>
                    )}
                </div>
                <div className='space-y-1.5'>
                    {dayAppointments.map(app => (
                        <div
                            key={app.id}
                            className='text-[9px] md:text-[10px] p-1.5 rounded-lg bg-white/5 text-blue-400 border border-white/5 truncate font-bold flex items-center gap-1.5 hover:bg-white/10 transition-colors'
                            title={`${app.time} - ${app.name}`}
                        >
                            <div className='w-1.5 h-1.5 rounded-full bg-blue-500' />
                            {app.time} {app.name}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className='glass border-white/10 rounded-3xl overflow-hidden shadow-2xl'>
            <div className='p-6 flex items-center justify-between border-b border-white/5 bg-white/5'>
                <h3 className='text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex items-center gap-3'>
                    {monthName} <span className='text-blue-500'>{year}</span>
                </h3>
                <div className='flex items-center gap-3'>
                    <button
                        onClick={prevMonth}
                        className='p-2 rounded-xl glass border-white/10 hover:bg-white/10 transition-all text-white'
                    >
                        <ChevronLeft className='w-5 h-5' />
                    </button>
                    <button
                        onClick={nextMonth}
                        className='p-2 rounded-xl glass border-white/10 hover:bg-white/10 transition-all text-white'
                    >
                        <ChevronRight className='w-5 h-5' />
                    </button>
                </div>
            </div>

            <div className='grid grid-cols-7 text-center border-b border-white/5 bg-white/[0.02]'>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div
                        key={day}
                        className='py-3 text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]'
                    >
                        {day}
                    </div>
                ))}
            </div>

            <div className='grid grid-cols-7'>{days}</div>
        </div>
    );
};
