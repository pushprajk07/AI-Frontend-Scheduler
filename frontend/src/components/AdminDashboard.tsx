import React, { useState } from 'react';
import { Appointment, AppointmentStatus, AITone } from '../types';
import {
    Search,
    Trash2,
    RefreshCw,
    Download,
    Clock,
    Calendar as CalendarIcon,
    Mail,
    Phone,
    Filter,
    FileText,
    ChevronDown,
    ChevronUp,
    Sparkles
} from 'lucide-react';

interface AdminDashboardProps {
    appointments: Appointment[];
    onUpdateStatus: (id: string | number, status: AppointmentStatus) => void;
    onDelete: (id: string | number) => void;
    onRegenerateAI: (id: string | number, tone: AITone) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    appointments,
    onUpdateStatus,
    onDelete,
    onRegenerateAI
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'All'>('All');
    const [regeneratingId, setRegeneratingId] = useState<string | number | null>(null);
    const [expandedAppId, setExpandedAppId] = useState<string | number | null>(null);

    const filteredAppointments = appointments.filter(app => {
        const matchesSearch =
            app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || app.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleRegenerate = async (id: string | number, tone: AITone) => {
        setRegeneratingId(id);
        await onRegenerateAI(id, tone);
        setRegeneratingId(null);
    };

    const toggleExpand = (id: string | number) => {
        setExpandedAppId(expandedAppId === id ? null : id);
    };

    const exportToJSON = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appointments, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', 'appointments.json');
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const getStatusColor = (status: AppointmentStatus) => {
        switch (status) {
            case 'Scheduled':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Completed':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Cancelled':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
        }
    };

    return (
        <div className='space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
                <div>
                    <h2 className='text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent'>
                        Manage Bookings
                    </h2>
                    <p className='text-slate-400'>Review appointments and AI-generated communication assets.</p>
                </div>
                <div className='flex items-center gap-3'>
                    <button
                        onClick={exportToJSON}
                        className='flex items-center gap-2 px-5 py-2.5 glass border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-semibold text-white shadow-lg'
                    >
                        <Download className='w-4 h-4' />
                        Export All
                    </button>
                </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                <div className='relative md:col-span-2'>
                    <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <input
                        type='text'
                        placeholder='Search client name or email...'
                        className='w-full pl-12 pr-4 py-3.5 glass border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500/50'
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className='flex items-center gap-3 glass border-white/10 rounded-2xl px-4 py-3.5'>
                    <Filter className='w-4 h-4 text-slate-400' />
                    <select
                        className='w-full bg-transparent border-none outline-none cursor-pointer text-white text-sm'
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                    >
                        <option
                            value='All'
                            className='bg-slate-900'
                        >
                            All Statuses
                        </option>
                        <option
                            value='Scheduled'
                            className='bg-slate-900'
                        >
                            Scheduled
                        </option>
                        <option
                            value='Completed'
                            className='bg-slate-900'
                        >
                            Completed
                        </option>
                        <option
                            value='Cancelled'
                            className='bg-slate-900'
                        >
                            Cancelled
                        </option>
                    </select>
                </div>
            </div>

            <div className='glass border-white/10 rounded-3xl overflow-hidden shadow-2xl'>
                <div className='overflow-x-auto'>
                    <table className='w-full text-left border-collapse'>
                        <thead>
                            <tr className='bg-white/5 border-b border-white/5'>
                                <th className='px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400'>
                                    Client
                                </th>
                                <th className='px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400'>
                                    Schedule
                                </th>
                                <th className='px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400'>
                                    Status
                                </th>
                                <th className='px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400'>
                                    AI Intelligence
                                </th>
                                <th className='px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400 text-right'>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-white/5'>
                            {filteredAppointments.length > 0 ? (
                                filteredAppointments.map(app => (
                                    <React.Fragment key={app.id}>
                                        <tr
                                            className={`hover:bg-white/5 transition-all group ${expandedAppId === app.id ? 'bg-white/5' : ''}`}
                                        >
                                            <td className='px-8 py-6'>
                                                <div className='font-bold text-white text-lg'>{app.name}</div>
                                                <div className='text-xs text-slate-500 flex flex-col gap-1 mt-2'>
                                                    <span className='flex items-center gap-2'>
                                                        <Mail className='w-3 h-3' /> {app.email}
                                                    </span>
                                                    <span className='flex items-center gap-2'>
                                                        <Phone className='w-3 h-3' /> {app.phone}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className='px-8 py-6'>
                                                <div className='flex items-center gap-2 mb-2'>
                                                    <span className='px-3 py-1 rounded-lg text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-tighter'>
                                                        {app.meetingType}
                                                    </span>
                                                </div>
                                                <div className='text-sm flex items-center gap-2 text-slate-300'>
                                                    <CalendarIcon className='w-4 h-4 text-blue-500' />
                                                    {new Date(app.date).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </div>
                                                <div className='text-sm flex items-center gap-2 text-slate-300 mt-1.5'>
                                                    <Clock className='w-4 h-4 text-purple-500' />
                                                    {app.time}
                                                </div>
                                                {app.timezone && (
                                                    <div className='text-[10px] text-slate-500 flex items-center gap-2 mt-1.5'>
                                                        <span className='w-4' />{' '}
                                                        {/* Spacer to align with text after icon */}
                                                        {app.timezone}
                                                    </div>
                                                )}
                                            </td>
                                            <td className='px-8 py-6'>
                                                <select
                                                    className={`text-[10px] font-black px-4 py-1.5 rounded-full border border-white/5 cursor-pointer focus:ring-2 focus:ring-blue-500/50 appearance-none bg-slate-900/50 backdrop-blur-sm tracking-wider uppercase ${getStatusColor(app.status)}`}
                                                    value={app.status}
                                                    onChange={e =>
                                                        onUpdateStatus(app.id, e.target.value as AppointmentStatus)
                                                    }
                                                >
                                                    <option value='Scheduled'>Scheduled</option>
                                                    <option value='Completed'>Completed</option>
                                                    <option value='Cancelled'>Cancelled</option>
                                                </select>
                                            </td>
                                            <td className='px-8 py-6'>
                                                <div className='flex flex-col gap-2'>
                                                    <div className='flex items-center gap-2'>
                                                        <Sparkles className='w-4 h-4 text-blue-400' />
                                                        <span className='text-xs font-semibold text-slate-300'>
                                                            {app.tone} Tone
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleExpand(app.id)}
                                                        className='text-[10px] font-black text-blue-400 flex items-center gap-2 hover:text-blue-300 transition-colors uppercase tracking-widest'
                                                    >
                                                        {expandedAppId === app.id ? (
                                                            <ChevronUp className='w-3.5 h-3.5' />
                                                        ) : (
                                                            <ChevronDown className='w-3.5 h-3.5' />
                                                        )}
                                                        View Assets
                                                    </button>
                                                </div>
                                            </td>
                                            <td className='px-8 py-6 text-right'>
                                                <button
                                                    onClick={() => onDelete(app.id)}
                                                    className='p-3 text-red-400 hover:bg-red-500/20 rounded-2xl transition-all hover:scale-110 shadow-lg'
                                                    title='Delete Booking'
                                                >
                                                    <Trash2 className='w-5 h-5' />
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedAppId === app.id && (
                                            <tr className='bg-white/[0.02] animate-in slide-in-from-top-2 duration-300'>
                                                <td
                                                    colSpan={5}
                                                    className='px-8 py-8 border-t border-white/5'
                                                >
                                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                                                        <div className='space-y-4'>
                                                            <div className='flex items-center justify-between'>
                                                                <h5 className='text-sm font-bold text-white flex items-center gap-2'>
                                                                    <Mail className='w-4 h-4 text-blue-400' />
                                                                    Confirmation Email
                                                                </h5>
                                                                <div className='flex items-center gap-2'>
                                                                    {(
                                                                        [
                                                                            'Persuasive',
                                                                            'Formal',
                                                                            'Friendly Professional'
                                                                        ] as AITone[]
                                                                    ).map(t => (
                                                                        <button
                                                                            key={t}
                                                                            onClick={() => handleRegenerate(app.id, t)}
                                                                            disabled={
                                                                                regeneratingId === app.id ||
                                                                                app.tone === t
                                                                            }
                                                                            className={`px-2 py-1 rounded text-[9px] font-black transition-all uppercase tracking-tighter ${
                                                                                app.tone === t
                                                                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                                                                    : 'bg-white/5 text-slate-500 border border-white/10 hover:bg-white/10'
                                                                            } disabled:opacity-50`}
                                                                        >
                                                                            {t.split(' ')[0]}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className='p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-400 whitespace-pre-wrap font-mono h-48 overflow-y-auto custom-scrollbar'>
                                                                {app.confirmationEmail}
                                                            </div>

                                                            <div className='space-y-4 pt-4 border-t border-white/5'>
                                                                <h5 className='text-sm font-bold text-white flex items-center gap-2'>
                                                                    <Sparkles className='w-4 h-4 text-blue-400' />
                                                                    Meeting{' '}
                                                                    {app.meetingType === 'Offline'
                                                                        ? 'Location'
                                                                        : 'Link'}
                                                                </h5>
                                                                <div className='p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-blue-400 break-all font-mono'>
                                                                    {app.meetingLink ? (
                                                                        app.meetingType === 'Offline' ? (
                                                                            app.meetingLink
                                                                        ) : (
                                                                            <a
                                                                                href={app.meetingLink}
                                                                                target='_blank'
                                                                                rel='noopener noreferrer'
                                                                                className='hover:underline'
                                                                            >
                                                                                {app.meetingLink}
                                                                            </a>
                                                                        )
                                                                    ) : (
                                                                        'Not specified'
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className='space-y-6'>
                                                            <div className='space-y-4'>
                                                                <h5 className='text-sm font-bold text-white flex items-center gap-2'>
                                                                    <Clock className='w-4 h-4 text-purple-400' />
                                                                    Reminder Message
                                                                </h5>
                                                                <div className='p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-400 whitespace-pre-wrap font-mono'>
                                                                    {app.reminderMessage}
                                                                </div>
                                                            </div>
                                                            <div className='space-y-4'>
                                                                <h5 className='text-sm font-bold text-white flex items-center gap-2'>
                                                                    <RefreshCw className='w-4 h-4 text-orange-400' />
                                                                    Reschedule/Cancellation
                                                                </h5>
                                                                <div className='grid grid-cols-1 gap-4'>
                                                                    <div className='p-3 rounded-xl bg-black/20 border border-white/5 text-[10px] text-slate-400'>
                                                                        <span className='text-orange-400 font-bold block mb-1 uppercase tracking-tighter'>
                                                                            Reschedule:
                                                                        </span>
                                                                        {app.rescheduleMessage}
                                                                    </div>
                                                                    <div className='p-3 rounded-xl bg-black/20 border border-white/5 text-[10px] text-slate-400'>
                                                                        <span className='text-red-400 font-bold block mb-1 uppercase tracking-tighter'>
                                                                            Cancellation:
                                                                        </span>
                                                                        {app.cancellationMessage}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className='space-y-4'>
                                                                <h5 className='text-sm font-bold text-white flex items-center gap-2'>
                                                                    <FileText className='w-4 h-4 text-emerald-400' />
                                                                    Suggested Agenda
                                                                </h5>
                                                                <div className='p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-400 whitespace-pre-wrap font-mono'>
                                                                    {app.meetingAgenda}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className='px-8 py-24 text-center'
                                    >
                                        <div className='flex flex-col items-center gap-4'>
                                            <div className='p-8 glass border-white/5 rounded-full bg-white/5'>
                                                <CalendarIcon className='w-16 h-16 text-slate-700' />
                                            </div>
                                            <h3 className='text-xl font-bold text-slate-400 mt-2'>
                                                No Appointments Found
                                            </h3>
                                            <p className='text-slate-500 max-w-xs mx-auto'>
                                                Start by booking an appointment through the main scheduler.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
