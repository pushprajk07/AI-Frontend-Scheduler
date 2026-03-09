import React, { useState } from 'react';
import { Appointment, MeetingType } from '../types';
import {
    Calendar as CalendarIcon,
    Clock,
    User,
    Mail,
    Phone,
    Video,
    Send,
    Loader2,
    CheckCircle2,
    Sparkles,
    PlusCircle,
    Download,
    CalendarPlus,
    Lightbulb,
    Check
} from 'lucide-react';
import { aiService } from '../services/ai.service';
import { appointmentService } from '../services/appointment.service';
import { AIOutput } from './AIOutput';
import { formatTo12Hour, getTimezoneString, generateCalendarLinks } from '../lib/utils';

interface BookingFormProps {
    onSuccess: (appointment: Appointment) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        meetingType: 'Consultation' as MeetingType,
        date: '',
        time: '',
        location: ''
    });

    const [loading, setLoading] = useState(false);
    const [lastCreatedAppointment, setLastCreatedAppointment] = useState<Appointment | null>(null);
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [dateError, setDateError] = useState('');
    const [suggestingSlots, setSuggestingSlots] = useState(false);
    const [suggestedSlots, setSuggestedSlots] = useState<{ date: string; time: string }[]>([]);

    const validateName = (name: string) => {
        if (!name) return false;
        const nameRegex = /^[A-Za-z\s]+$/;
        return nameRegex.test(name) && name.trim().length >= 2;
    };

    const validateEmail = (email: string) => {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string) => {
        if (!phone) return false;
        // Must be exactly 10 digits, optional + at start
        const phoneRegex = /^\+?\d{10}$/;
        return phoneRegex.test(phone);
    };

    const validateDate = (date: string) => {
        if (!date) return false;
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selectedDate >= today;
    };

    const isFormValid = () => {
        const baseValid =
            validateName(formData.name) &&
            validateEmail(formData.email) &&
            validatePhone(formData.phone) &&
            validateDate(formData.date) &&
            formData.time;

        if (formData.meetingType === 'Offline') {
            return baseValid && formData.location.trim().length > 0;
        }

        return baseValid;
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData({ ...formData, name: value });

        if (value && !validateName(value)) {
            setNameError('Please enter a valid full name.');
        } else {
            setNameError('');
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData({ ...formData, email: value });

        if (value && !validateEmail(value)) {
            setEmailError('Please enter a valid email address.');
        } else {
            setEmailError('');
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;

        // Prevent typing non-allowed characters
        // Only allow + at start, and digits elsewhere
        if (value.length > 0) {
            const firstChar = value[0] === '+' ? '+' : '';
            const rest = value.slice(firstChar ? 1 : 0).replace(/[^\d]/g, '');
            value = firstChar + rest;
        }

        setFormData({ ...formData, phone: value });

        if (value && !validatePhone(value)) {
            setPhoneError('Please enter a valid 10-digit phone number.');
        } else {
            setPhoneError('');
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData({ ...formData, date: value });

        if (value && !validateDate(value)) {
            setDateError('Please select a future date.');
        } else {
            setDateError('');
        }
    };

    const getDefaultTone = (type: MeetingType) => {
        switch (type) {
            case 'Demo':
                return 'Persuasive';
            case 'Interview':
                return 'Formal';
            case 'Consultation':
                return 'Friendly Professional';
            case 'Online':
                return 'Friendly Professional';
            case 'Offline':
                return 'Friendly Professional';
            default:
                return 'Friendly Professional';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isFormValid()) {
            if (!validateName(formData.name)) {
                setNameError('Please enter a valid full name.');
            }
            if (!validateEmail(formData.email)) {
                setEmailError('Please enter a valid email address.');
            }
            if (!validatePhone(formData.phone)) {
                setPhoneError('Please enter a valid 10-digit phone number.');
            }
            if (!validateDate(formData.date)) {
                setDateError('Please select a future date.');
            }
            if (formData.meetingType === 'Offline' && !formData.location.trim()) {
                setError('Please enter a physical location for offline meeting.');
                return;
            }
            setError('Please fill in all required fields correctly.');
            return;
        }

        setLoading(true);

        try {
            const formattedDate = new Date(formData.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });

            const formattedTime = formatTo12Hour(formData.time);

            const tone = getDefaultTone(formData.meetingType);

            // First generate AI content
            const aiContent = await aiService.generateContent({
                name: formData.name,
                meetingType: formData.meetingType,
                date: formattedDate,
                time: formattedTime,
                tone
            });

            // Generate random Meeting ID
            const meetingId =
                Math.random()
                    .toString(36)
                    .substring(2, 11)
                    .toUpperCase()
                    .match(/.{1,3}/g)
                    ?.join('-') || 'ABC-DEF-GHI';

            let meetingLink = '';
            let finalMeetingId = meetingId;

            if (formData.meetingType === 'Offline') {
                meetingLink = formData.location || 'Physical Office Location';
                finalMeetingId = 'Physical Location';
            } else {
                // Online, Demo, Interview, Consultation default to Online
                meetingLink = `https://zoom.us/j/${meetingId.replace(/-/g, '')}`;
            }

            const { name, email, phone, meetingType, date } = formData;
            const appointmentData: Partial<Appointment> = {
                name,
                email,
                phone,
                meetingType,
                date,
                time: formattedTime,
                timezone: getTimezoneString(),
                status: 'Scheduled',
                duration: '30 minutes',
                meetingLink,
                meetingId: finalMeetingId,
                ...aiContent,
                tone
            };

            const newAppointment = await appointmentService.create(appointmentData);

            onSuccess(newAppointment);
            setLastCreatedAppointment(newAppointment);
            setFormData({
                name: '',
                email: '',
                phone: '',
                meetingType: 'Consultation',
                date: '',
                time: '',
                location: ''
            });
        } catch (err) {
            console.error(err);
            setError('Failed to book appointment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSuggestSlots = async () => {
        if (!lastCreatedAppointment) return;
        setSuggestingSlots(true);
        try {
            const result = await aiService.suggestSlots({
                currentDate: lastCreatedAppointment.date,
                currentTime: lastCreatedAppointment.time,
                meetingType: lastCreatedAppointment.meetingType
            });
            setSuggestedSlots(result.slots);
        } catch (err) {
            console.error(err);
            setError('Failed to suggest alternative slots.');
        } finally {
            setSuggestingSlots(false);
        }
    };

    const handleReschedule = async (date: string, time: string) => {
        if (!lastCreatedAppointment) return;
        setLoading(true);
        try {
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            const formattedTime = formatTo12Hour(time);

            // Regenerate AI content for the new time
            const aiContent = await aiService.generateContent({
                name: lastCreatedAppointment.name,
                meetingType: lastCreatedAppointment.meetingType,
                date: formattedDate,
                time: formattedTime,
                tone: lastCreatedAppointment.tone || 'Friendly Professional'
            });

            const updated = await appointmentService.update(lastCreatedAppointment.id, {
                date,
                time: formattedTime,
                ...aiContent
            });

            setLastCreatedAppointment(updated);
            setSuggestedSlots([]);
        } catch (err) {
            console.error(err);
            setError('Failed to reschedule.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAppointment = (updated: Appointment) => {
        setLastCreatedAppointment(updated);
        // Also update in parent if needed, but App.tsx handleBookingSuccess already added it.
        // For simplicity in this local version, we'll just update the local view.
        // In a real app, you'd use a context or state management for this.
    };

    const resetForm = () => {
        setLastCreatedAppointment(null);
    };

    if (lastCreatedAppointment) {
        return (
            <div className='max-w-4xl mx-auto space-y-8'>
                <div className='glass p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden'>
                    <div className='absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -z-10' />
                    <div className='absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 blur-[100px] -z-10' />

                    <div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
                        <div className='flex items-center gap-6'>
                            <div className='bg-emerald-500/20 p-4 rounded-3xl border border-emerald-500/30'>
                                <CheckCircle2 className='w-10 h-10 text-emerald-400' />
                            </div>
                            <div>
                                <h2 className='text-3xl font-bold text-white'>Booking Confirmed!</h2>
                                <p className='text-slate-400'>
                                    Your {lastCreatedAppointment.meetingType} with {lastCreatedAppointment.name} is
                                    scheduled.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={resetForm}
                            className='flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl border border-white/10 transition-all font-semibold'
                        >
                            <PlusCircle className='w-5 h-5' />
                            Book Another
                        </button>
                    </div>

                    <div className='mt-10 grid grid-cols-2 md:grid-cols-4 gap-4'>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Date</p>
                            <p className='text-white font-medium'>
                                {new Date(lastCreatedAppointment.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Time</p>
                            <p className='text-white font-medium'>{lastCreatedAppointment.time}</p>
                            {lastCreatedAppointment.timezone && (
                                <p className='text-[10px] text-slate-500 mt-1.5 font-light leading-none'>
                                    Timezone: <span className='text-slate-400'>{lastCreatedAppointment.timezone}</span>
                                </p>
                            )}
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Duration</p>
                            <p className='text-white font-medium'>{lastCreatedAppointment.duration}</p>
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Status</p>
                            <p className='text-emerald-400 font-medium'>{lastCreatedAppointment.status}</p>
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Meeting Type</p>
                            <p className='text-white font-medium'>
                                {lastCreatedAppointment.meetingType === 'Offline'
                                    ? 'In-Person (Offline)'
                                    : 'Online (Zoom)'}
                            </p>
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Meeting ID</p>
                            <p className='text-white font-mono text-sm'>{lastCreatedAppointment.meetingId}</p>
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5 col-span-2'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>Purpose</p>
                            <p className='text-white font-medium'>{lastCreatedAppointment.meetingType}</p>
                        </div>
                        <div className='p-4 rounded-2xl bg-white/5 border border-white/5 col-span-2 md:col-span-4'>
                            <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>
                                {lastCreatedAppointment.meetingType === 'Offline'
                                    ? 'Physical Location'
                                    : 'Meeting Link'}
                            </p>
                            {lastCreatedAppointment.meetingType === 'Offline' ? (
                                <p className='text-blue-400 font-medium truncate block'>
                                    {lastCreatedAppointment.meetingLink}
                                </p>
                            ) : (
                                <a
                                    href={lastCreatedAppointment.meetingLink}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-blue-400 font-medium truncate block hover:underline'
                                >
                                    {lastCreatedAppointment.meetingLink}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className='glass p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-700'>
                    <div className='flex flex-col gap-6'>
                        <div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
                            <div>
                                <h3 className='text-lg font-semibold text-white mb-1 flex items-center gap-2'>
                                    <Lightbulb className='w-5 h-5 text-amber-400' />
                                    Suggest Better Time
                                </h3>
                                <p className='text-sm text-slate-400'>
                                    Not sure about this slot? Let AI suggest better alternatives.
                                </p>
                            </div>
                            <button
                                onClick={handleSuggestSlots}
                                disabled={suggestingSlots || loading}
                                className='flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-6 py-3 rounded-xl border border-amber-500/20 transition-all text-sm font-semibold group active:scale-95 disabled:opacity-50'
                            >
                                {suggestingSlots ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                ) : (
                                    <Sparkles className='w-4 h-4 group-hover:rotate-12 transition-transform' />
                                )}
                                Suggest Alternative Slots
                            </button>
                        </div>

                        {suggestedSlots.length > 0 && (
                            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5 animate-in fade-in zoom-in-95 duration-500'>
                                {suggestedSlots.map((slot, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleReschedule(slot.date, slot.time)}
                                        className='p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group'
                                    >
                                        <p className='text-xs text-slate-500 uppercase tracking-wider mb-1'>
                                            Option {index + 1}
                                        </p>
                                        <p className='text-white font-medium'>
                                            {new Date(slot.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </p>
                                        <p className='text-blue-400 text-sm font-bold flex items-center justify-between'>
                                            {slot.time}
                                            <Check className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className='glass p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-700'>
                    <div className='flex flex-col md:flex-row md:items-center justify-between gap-6'>
                        <div>
                            <h3 className='text-lg font-semibold text-white mb-1 flex items-center gap-2'>
                                <CalendarIcon className='w-5 h-5 text-blue-400' />
                                Save to Calendar
                            </h3>
                            <p className='text-sm text-slate-400'>
                                Add this meeting to your preferred calendar to stay updated.
                            </p>
                        </div>
                        <div className='flex flex-wrap gap-3'>
                            <button
                                onClick={() => {
                                    const { googleLink } = generateCalendarLinks(lastCreatedAppointment);
                                    window.open(googleLink, '_blank');
                                }}
                                className='flex items-center gap-2 bg-[#4285F4]/10 hover:bg-[#4285F4]/20 text-[#4285F4] px-5 py-3 rounded-xl border border-[#4285F4]/20 transition-all text-sm font-semibold group active:scale-95'
                            >
                                <CalendarPlus className='w-4 h-4 group-hover:scale-110 transition-transform' />
                                Google Calendar
                            </button>
                            <button
                                onClick={() => {
                                    const { outlookLink } = generateCalendarLinks(lastCreatedAppointment);
                                    window.open(outlookLink, '_blank');
                                }}
                                className='flex items-center gap-2 bg-[#0078D4]/10 hover:bg-[#0078D4]/20 text-[#0078D4] px-5 py-3 rounded-xl border border-[#0078D4]/20 transition-all text-sm font-semibold group active:scale-95'
                            >
                                <Mail className='w-4 h-4 group-hover:scale-110 transition-transform' />
                                Outlook
                            </button>
                            <button
                                onClick={() => {
                                    const { icsContent } = generateCalendarLinks(lastCreatedAppointment);
                                    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `meeting-${lastCreatedAppointment.id}.ics`);
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className='flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl border border-white/10 transition-all text-sm font-semibold group active:scale-95 shadow-lg shadow-black/20'
                            >
                                <Download className='w-4 h-4 group-hover:scale-110 transition-transform' />
                                Download .ics
                            </button>
                        </div>
                    </div>
                </div>

                <AIOutput
                    appointment={lastCreatedAppointment}
                    onUpdate={handleUpdateAppointment}
                />
            </div>
        );
    }

    return (
        <div className='max-w-2xl mx-auto glass p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative'>
            <div className='absolute -top-4 -right-4 bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg animate-bounce'>
                <Sparkles className='w-6 h-6 text-white' />
            </div>

            <div className='mb-10'>
                <h2 className='text-3xl font-bold mb-3 text-white'>Schedule Now</h2>
                <p className='text-slate-400 font-light'>
                    Enter meeting details and our AI will prepare all communication assets.
                </p>
            </div>

            {error && (
                <div className='mb-8 p-5 glass border-red-500/30 text-red-400 rounded-2xl animate-in zoom-in-95 duration-300'>
                    {error}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className='space-y-8'
            >
                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                    <div className='flex flex-col gap-2'>
                        <div className='floating-label-group'>
                            <input
                                type='text'
                                placeholder=' '
                                className={`w-full px-4 py-4 rounded-xl border bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all hover:bg-white/10 ${nameError ? 'border-red-500/50' : 'border-white/10'}`}
                                value={formData.name}
                                onChange={handleNameChange}
                            />
                            <label className='floating-label flex items-center gap-2'>
                                <User className='w-4 h-4' />
                                Pushpraj Kumar
                            </label>
                        </div>
                        {nameError && (
                            <p className='text-red-400 text-xs pl-1 animate-in fade-in slide-in-from-top-1 duration-200'>
                                {nameError}
                            </p>
                        )}
                    </div>
                    <div className='flex flex-col gap-2'>
                        <div className='floating-label-group'>
                            <input
                                type='email'
                                placeholder=' '
                                className={`w-full px-4 py-4 rounded-xl border bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all hover:bg-white/10 ${emailError ? 'border-red-500/50' : 'border-white/10'}`}
                                value={formData.email}
                                onChange={handleEmailChange}
                            />
                            <label className='floating-label flex items-center gap-2'>
                                <Mail className='w-4 h-4' />
                                pushprajkpr7@gmail.com
                            </label>
                        </div>
                        {emailError && (
                            <p className='text-red-400 text-xs pl-1 animate-in fade-in slide-in-from-top-1 duration-200'>
                                {emailError}
                            </p>
                        )}
                    </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                    <div className='flex flex-col gap-2'>
                        <div className='floating-label-group'>
                            <input
                                type='tel'
                                placeholder=' '
                                className={`w-full px-4 py-4 rounded-xl border bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all hover:bg-white/10 ${phoneError ? 'border-red-500/50' : 'border-white/10'}`}
                                value={formData.phone}
                                onChange={handlePhoneChange}
                            />
                            <label className='floating-label flex items-center gap-2'>
                                <Phone className='w-4 h-4' />
                                +91 XXXXX XXXXX
                            </label>
                        </div>
                        {phoneError && (
                            <p className='text-red-400 text-xs pl-1 animate-in fade-in slide-in-from-top-1 duration-200'>
                                {phoneError}
                            </p>
                        )}
                    </div>
                    <div className='floating-label-group'>
                        <select
                            className='w-full px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer hover:bg-white/10'
                            value={formData.meetingType}
                            onChange={e => setFormData({ ...formData, meetingType: e.target.value as MeetingType })}
                        >
                            <option
                                value='Demo'
                                className='bg-slate-900 text-white'
                            >
                                Demo (Persuasive)
                            </option>
                            <option
                                value='Interview'
                                className='bg-slate-900 text-white'
                            >
                                Interview (Formal)
                            </option>
                            <option
                                value='Consultation'
                                className='bg-slate-900 text-white'
                            >
                                Consultation (Friendly)
                            </option>
                            <option
                                value='Online'
                                className='bg-slate-900 text-white'
                            >
                                Online (Zoom)
                            </option>
                            <option
                                value='Offline'
                                className='bg-slate-900 text-white'
                            >
                                Offline (In-Person)
                            </option>
                        </select>
                        <label className='floating-label flex items-center gap-2'>
                            <Video className='w-4 h-4' />
                            Meeting Type
                        </label>
                    </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                    <div className='flex flex-col gap-2'>
                        <div className='floating-label-group'>
                            <input
                                type='date'
                                className={`w-full px-4 py-4 rounded-xl border bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all cursor-pointer hover:bg-white/10 ${dateError ? 'border-red-500/50' : 'border-white/10'}`}
                                value={formData.date}
                                onChange={handleDateChange}
                                min={new Date().toISOString().split('T')[0]}
                            />
                            <label className='floating-label flex items-center gap-2'>
                                <CalendarIcon className='w-4 h-4' />
                                Date
                            </label>
                        </div>
                        {dateError && (
                            <p className='text-red-400 text-xs pl-1 animate-in fade-in slide-in-from-top-1 duration-200'>
                                {dateError}
                            </p>
                        )}
                    </div>
                    <div className='floating-label-group'>
                        <input
                            type='time'
                            className='w-full px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all cursor-pointer hover:bg-white/10'
                            value={formData.time}
                            onChange={e => setFormData({ ...formData, time: e.target.value })}
                        />
                        <label className='floating-label flex items-center gap-2'>
                            <Clock className='w-4 h-4' />
                            Time
                        </label>
                    </div>
                </div>

                {formData.meetingType === 'Offline' && (
                    <div className='animate-in fade-in slide-in-from-top-4 duration-300'>
                        <div className='floating-label-group'>
                            <input
                                type='text'
                                placeholder=' '
                                className='w-full px-4 py-4 rounded-xl border border-white/10 bg-white/5 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all hover:bg-white/10'
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                            <label className='floating-label flex items-center gap-2'>
                                <PlusCircle className='w-4 h-4' />
                                Physical Location (e.g., Office Address)
                            </label>
                        </div>
                    </div>
                )}

                <button
                    type='submit'
                    disabled={loading || !isFormValid()}
                    className='w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed relative overflow-hidden group shadow-lg'
                >
                    <div className='absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300' />
                    {loading ? (
                        <>
                            <Loader2 className='w-6 h-6 animate-spin text-white' />
                            <span className='animate-pulse tracking-wide'>Preparing AI assets...</span>
                        </>
                    ) : (
                        <>
                            <Send className='w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform' />
                            Finalize & Generate Assets
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};
