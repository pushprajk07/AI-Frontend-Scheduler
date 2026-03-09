import React, { useState, useEffect } from 'react';
import { Appointment, AITone } from '../types';
import { Mail, Bell, ListTodo, RefreshCw, Check, Copy, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { aiService } from '../services/ai.service';
import { formatTo12Hour } from '../lib/utils';

interface AIOutputProps {
    appointment: Appointment;
    onUpdate: (updatedAppointment: Appointment) => void;
}

export const AIOutput: React.FC<AIOutputProps> = ({ appointment, onUpdate }) => {
    const [regenerating, setRegenerating] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastConfig, setToastConfig] = useState<{ message: string; isError: boolean }>({
        message: 'Copied successfully!',
        isError: false
    });
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        email: true,
        reminder: true,
        agenda: true
    });

    useEffect(() => {
        setInitialLoading(true);
        const timer = setTimeout(() => {
            setInitialLoading(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, [appointment.id]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const copyToClipboard = async (text: string, field: string) => {
        let success = false;

        const showFeedback = (isSuccess: boolean) => {
            if (isSuccess) {
                setCopiedField(field);
                setToastConfig({ message: 'Copied successfully!', isError: false });
            } else {
                setToastConfig({ message: 'Failed to copy. Please try manually.', isError: true });
            }
            setShowToast(true);
            setTimeout(() => {
                setCopiedField(null);
                setShowToast(false);
            }, 2000);
        };

        try {
            // Priority 1: Modern Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                success = true;
            }
        } catch (err) {
            console.warn('Clipboard API failed, trying fallback', err);
        }

        if (!success) {
            // Priority 2: Fallback to document.execCommand
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;

                // Ensure the textarea is not visible but still part of the document
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                textArea.style.top = '0';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);

                textArea.focus();
                textArea.select();

                success = document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (copyErr) {
                console.error('Fallback copy failed', copyErr);
                success = false;
            }
        }

        showFeedback(success);
    };

    const handleRegenerate = async (newTone: AITone) => {
        setRegenerating(true);
        try {
            const formattedDate = new Date(appointment.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });

            const displayTime = formatTo12Hour(appointment.time);

            const newContent = await aiService.generateContent({
                name: appointment.name,
                meetingType: appointment.meetingType,
                date: formattedDate,
                time: displayTime,
                tone: newTone
            });

            onUpdate({
                ...appointment,
                ...newContent,
                tone: newTone
            });
        } catch (error) {
            console.error('Regeneration failed', error);
        } finally {
            setRegenerating(false);
        }
    };

    const sections = [
        {
            id: 'email',
            title: 'Confirmation Email',
            icon: <Mail className='w-5 h-5 text-blue-400' />,
            content: appointment.confirmationEmail
        },
        {
            id: 'reminder',
            title: 'Reminder Message (24h Before)',
            icon: <Bell className='w-5 h-5 text-purple-400' />,
            content: appointment.reminderMessage
        },
        {
            id: 'agenda',
            title: 'Suggested Meeting Agenda',
            icon: <ListTodo className='w-5 h-5 text-emerald-400' />,
            content: appointment.meetingAgenda
        }
    ];

    if (initialLoading) {
        return (
            <div className='mt-12 py-24 flex flex-col items-center justify-center gap-6 glass rounded-[2.5rem] border-white/10 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500'>
                <div className='absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px]' />
                <div className='absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[60px]' />

                <div className='relative'>
                    <div className='absolute inset-0 bg-blue-500/20 blur-xl animate-pulse rounded-full' />
                    <Loader2 className='w-16 h-16 text-blue-500 animate-spin relative z-10' />
                </div>

                <div className='text-center space-y-2 relative z-10'>
                    <h3 className='text-2xl font-bold text-white flex items-center justify-center gap-2'>
                        <Sparkles className='w-5 h-5 text-blue-400 animate-pulse' />
                        Generating AI assets...
                    </h3>
                    <p className='text-slate-400 animate-pulse font-light'>
                        Tailoring communication for your {appointment.meetingType}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className='mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700'>
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6'>
                <div>
                    <h3 className='text-2xl font-bold text-white flex items-center gap-3'>
                        <span className='bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent'>
                            AI Intelligence
                        </span>
                        <span className='text-sm font-normal px-3 py-1 bg-white/5 rounded-full border border-white/10 text-slate-400 uppercase tracking-wider'>
                            {appointment.tone} Tone
                        </span>
                    </h3>
                    <p className='text-slate-400 mt-2 text-sm font-light leading-relaxed max-w-lg'>
                        AI automatically adapts communication tone and generates structured scheduling assets in real
                        time.
                    </p>
                </div>

                <div className='flex items-center gap-2'>
                    <span className='text-sm text-slate-500 mr-2'>Try different tone:</span>
                    {(['Persuasive', 'Formal', 'Friendly Professional'] as AITone[]).map(t => (
                        <button
                            key={t}
                            onClick={() => handleRegenerate(t)}
                            disabled={regenerating || appointment.tone === t}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                appointment.tone === t
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                            } disabled:opacity-50`}
                        >
                            {t.split(' ')[0]}
                        </button>
                    ))}
                </div>
            </div>

            {regenerating ? (
                <div className='py-20 flex flex-col items-center justify-center gap-4 glass rounded-3xl border-white/10'>
                    <RefreshCw className='w-12 h-12 text-blue-500 animate-spin' />
                    <p className='text-xl font-medium text-white animate-pulse'>Re-imagining your communication...</p>
                    <p className='text-slate-400 text-sm'>
                        Fine-tuning the perfect {appointment.tone?.toLowerCase()} tone.
                    </p>
                </div>
            ) : (
                <div className='grid grid-cols-1 gap-6'>
                    {sections.map(section => (
                        <div
                            key={section.id}
                            className='glass rounded-3xl border-white/10 overflow-hidden group hover:border-white/20 transition-all duration-300'
                        >
                            <div
                                className='p-6 flex items-center justify-between cursor-pointer'
                                onClick={() => toggleSection(section.id)}
                            >
                                <div className='flex items-center gap-4'>
                                    <div className='p-3 rounded-2xl bg-white/5 group-hover:scale-110 transition-transform'>
                                        {section.icon}
                                    </div>
                                    <h4 className='text-lg font-semibold text-white'>{section.title}</h4>
                                </div>
                                <div className='flex items-center gap-4'>
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            copyToClipboard(section.content || '', section.id);
                                        }}
                                        className='p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-400 hover:text-white group/copy relative'
                                        title='Copy to clipboard'
                                    >
                                        {copiedField === section.id ? (
                                            <Check className='w-4 h-4 text-emerald-400 animate-in zoom-in duration-300' />
                                        ) : (
                                            <Copy className='w-4 h-4 transition-transform group-hover/copy:scale-110' />
                                        )}
                                    </button>
                                    {expandedSections[section.id] ? (
                                        <ChevronUp className='w-5 h-5 text-slate-500' />
                                    ) : (
                                        <ChevronDown className='w-5 h-5 text-slate-500' />
                                    )}
                                </div>
                            </div>

                            {expandedSections[section.id] && (
                                <div className='px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300'>
                                    <div className='p-5 rounded-2xl bg-white/5 border border-white/5 whitespace-pre-wrap text-slate-300 leading-relaxed font-light font-mono text-sm'>
                                        {section.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Toast Notification */}
            {showToast && (
                <div className='fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300'>
                    <div
                        className={`backdrop-blur-xl text-white px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-3 border ${
                            toastConfig.isError
                                ? 'bg-red-900/90 border-red-500/50'
                                : 'bg-slate-900/90 border-emerald-500/50'
                        }`}
                    >
                        <div
                            className={`p-1.5 rounded-full border ${
                                toastConfig.isError
                                    ? 'bg-red-500/20 border-red-500/30'
                                    : 'bg-emerald-500/20 border-emerald-500/30'
                            }`}
                        >
                            {toastConfig.isError ? (
                                <span className='text-red-400 font-bold text-xs px-1'>!</span>
                            ) : (
                                <Check className='w-3.5 h-3.5 text-emerald-400' />
                            )}
                        </div>
                        <span className='font-medium tracking-tight'>{toastConfig.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
