import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { BookingForm } from './components/BookingForm';
import { AdminDashboard } from './components/AdminDashboard';
import { CalendarView } from './components/CalendarView';
import { useAppointments } from './hooks/useAppointments';
import { Appointment, AITone } from './types';
import { Calendar, List, Plus } from 'lucide-react';
import { aiService } from './services/ai.service';
import { formatTo12Hour } from './lib/utils';

const App: React.FC = () => {
    const { appointments, addAppointment, updateAppointment, deleteAppointment } = useAppointments();
    const [activeTab, setActiveTab] = useState<'booking' | 'dashboard'>('booking');
    const [dashboardView, setDashboardView] = useState<'list' | 'calendar'>('list');

    const handleBookingSuccess = (appointment: Appointment) => {
        addAppointment(appointment);
    };

    const handleRegenerateAI = async (id: string | number, tone: AITone) => {
        const app = appointments.find(a => a.id === id);
        if (!app) return;

        const formattedDate = new Date(app.date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        const displayTime = formatTo12Hour(app.time);

        const aiContent = await aiService.generateContent({
            name: app.name,
            meetingType: app.meetingType,
            date: formattedDate,
            time: displayTime,
            tone
        });

        updateAppointment(id, { ...aiContent, tone });
    };

    return (
        <Layout
            activeTab={activeTab}
            setActiveTab={setActiveTab}
        >
            <div className='max-w-6xl mx-auto py-10'>
                {activeTab === 'booking' ? (
                    <div className='animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out'>
                        <div className='flex flex-col items-center mb-16 text-center px-4'>
                            <h2 className='text-4xl sm:text-5xl md:text-7xl font-black mb-6 tracking-tight leading-tight break-words max-w-full'>
                                <span className='bg-gradient-to-r from-blue-400 via-blue-600 to-purple-600 bg-clip-text text-transparent'>
                                    SmartSchedule AI
                                </span>
                            </h2>
                            <p className='text-muted-foreground text-xl md:text-2xl max-w-2xl font-light'>
                                Book smarter. Let AI handle the communication.
                            </p>
                        </div>
                        <BookingForm onSuccess={handleBookingSuccess} />

                        <div className='mt-20 grid grid-cols-1 md:grid-cols-3 gap-8'>
                            {[
                                {
                                    title: 'AI Driven',
                                    desc: 'Auto-generated professional messages for every booking.',
                                    icon: '✨'
                                },
                                {
                                    title: 'Fully Local',
                                    desc: 'Your data stays in your browser. No database required.',
                                    icon: '🔒'
                                },
                                {
                                    title: 'Modern UI',
                                    desc: 'Clean, responsive, and easy to use across all devices.',
                                    icon: '📱'
                                }
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className='glass p-8 rounded-3xl border border-white/5 text-center hover:scale-105 transition-transform duration-300 group'
                                >
                                    <div className='text-4xl mb-4 group-hover:animate-bounce'>{feature.icon}</div>
                                    <h3 className='text-xl font-bold mb-2 text-white'>{feature.title}</h3>
                                    <p className='text-sm text-slate-400'>{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className='animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8'>
                        <div className='flex items-center justify-between'>
                            <div className='flex items-center gap-1 p-1 bg-muted rounded-xl'>
                                <button
                                    onClick={() => setDashboardView('list')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        dashboardView === 'list'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <List className='w-4 h-4' />
                                    List View
                                </button>
                                <button
                                    onClick={() => setDashboardView('calendar')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        dashboardView === 'calendar'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Calendar className='w-4 h-4' />
                                    Calendar
                                </button>
                            </div>

                            <button
                                onClick={() => setActiveTab('booking')}
                                className='flex md:hidden items-center gap-2 bg-primary text-primary-foreground p-2 rounded-full'
                            >
                                <Plus className='w-5 h-5' />
                            </button>
                        </div>

                        {dashboardView === 'list' ? (
                            <AdminDashboard
                                appointments={appointments}
                                onUpdateStatus={(id, status) => updateAppointment(id, { status })}
                                onDelete={deleteAppointment}
                                onRegenerateAI={handleRegenerateAI}
                            />
                        ) : (
                            <div className='space-y-6'>
                                <div>
                                    <h2 className='text-2xl font-bold'>Appointment Calendar</h2>
                                    <p className='text-muted-foreground'>Visualize your schedule across the month.</p>
                                </div>
                                <CalendarView appointments={appointments} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default App;
