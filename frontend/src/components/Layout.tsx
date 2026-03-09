import React, { useState, useEffect } from 'react';
import { Calendar, PlusCircle, LayoutDashboard } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    activeTab: 'booking' | 'dashboard';
    setActiveTab: (tab: 'booking' | 'dashboard') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    // Ensure dark mode is active for cinematic feel
    useEffect(() => {
        if (theme !== 'dark') {
            toggleTheme();
        }
    }, [theme]);

    return (
        <div className="min-h-screen bg-[#020617] text-foreground transition-colors duration-300 relative overflow-hidden font-['Poppins']">
            {/* Animated Background */}
            <div className='glow-bg'>
                <div className='glow-orb w-[600px] h-[600px] bg-blue-600/10 top-[-10%] left-[-10%] animate-pulse' />
                <div className='glow-orb w-[500px] h-[500px] bg-purple-600/10 bottom-[-5%] right-[-5%] animation-delay-2000 animate-pulse' />
                <div className='glow-orb w-[400px] h-[400px] bg-blue-400/5 top-[20%] right-[10%] animation-delay-5000 animate-pulse' />
            </div>

            {/* Header */}
            <header className='sticky top-0 z-40 w-full border-b border-white/5 bg-[#020617]/50 backdrop-blur-2xl'>
                <div className='container flex h-24 items-center justify-between px-6 md:px-12 mx-auto'>
                    <div
                        className='flex items-center gap-4 group cursor-pointer'
                        onClick={() => setActiveTab('booking')}
                    >
                        <div className='bg-gradient-to-br from-blue-600 to-purple-600 p-3 rounded-2xl shadow-2xl shadow-blue-500/20 group-hover:scale-110 transition-all duration-500 group-hover:rotate-3'>
                            <Calendar className='w-7 h-7 text-white' />
                        </div>
                        <div className='flex flex-col'>
                            <h1 className='text-2xl font-black tracking-tighter bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent'>
                                SmartSchedule AI
                            </h1>
                            <span className='text-[10px] uppercase tracking-[0.3em] text-blue-500 font-bold'>
                                Premium Edition
                            </span>
                        </div>
                    </div>

                    <div className='flex items-center gap-8'>
                        <nav className='hidden lg:flex items-center gap-10'>
                            <button
                                onClick={() => setActiveTab('booking')}
                                className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all hover:text-blue-400 ${
                                    activeTab === 'booking' ? 'text-blue-500' : 'text-slate-400'
                                }`}
                            >
                                <PlusCircle className='w-4 h-4' />
                                Book
                            </button>
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-all hover:text-blue-400 ${
                                    activeTab === 'dashboard' ? 'text-blue-500' : 'text-slate-400'
                                }`}
                            >
                                <LayoutDashboard className='w-4 h-4' />
                                Dashboard
                            </button>
                        </nav>

                        <div className='flex items-center gap-4'>
                            <div className='hidden sm:flex items-center px-4 py-2 glass border-white/5 rounded-2xl'>
                                <div className='w-2 h-2 rounded-full bg-green-500 animate-ping mr-3' />
                                <span className='text-[10px] font-black uppercase tracking-widest text-slate-300'>
                                    AI System Active
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Nav */}
            <div className='md:hidden fixed bottom-6 left-6 right-6 z-50 glass border-white/10 rounded-[2rem] px-8 h-20 flex items-center justify-around shadow-2xl'>
                <button
                    onClick={() => setActiveTab('booking')}
                    className={`flex flex-col items-center gap-1 transition-all ${
                        activeTab === 'booking' ? 'text-blue-500 scale-110' : 'text-slate-400'
                    }`}
                >
                    <PlusCircle className='w-6 h-6' />
                    <span className='text-[8px] font-black uppercase tracking-widest'>Book</span>
                </button>
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex flex-col items-center gap-1 transition-all ${
                        activeTab === 'dashboard' ? 'text-blue-500 scale-110' : 'text-slate-400'
                    }`}
                >
                    <LayoutDashboard className='w-6 h-6' />
                    <span className='text-[8px] font-black uppercase tracking-widest'>Admin</span>
                </button>
            </div>

            <main className='container mx-auto px-4 py-8 pb-24 md:pb-8'>{children}</main>
        </div>
    );
};
