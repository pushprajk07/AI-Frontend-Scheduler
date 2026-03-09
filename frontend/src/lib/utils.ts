import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatTo12Hour = (time: string): string => {
    if (!time) return '';

    // If already in 12-hour format, return as is
    if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
        return time;
    }

    // Expected format: HH:mm or HH:mm:ss
    const parts = time.split(':');
    if (parts.length < 2) return time;

    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];

    if (isNaN(hours)) return time;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${minutes} ${ampm}`;
};

export const getTimezoneString = (): string => {
    try {
        const date = new Date();
        // Get timezone name (e.g., IST, PST)
        const timezoneShort =
            new Intl.DateTimeFormat('en-US', {
                timeZoneName: 'short'
            })
                .formatToParts(date)
                .find(p => p.type === 'timeZoneName')?.value || '';

        // Get GMT offset (e.g., GMT+5:30)
        const offsetMinutes = -date.getTimezoneOffset();
        const hours = Math.floor(Math.abs(offsetMinutes) / 60);
        const minutes = Math.abs(offsetMinutes) % 60;
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const gmtOffset = `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;

        return `${timezoneShort} (${gmtOffset})`.trim();
    } catch {
        return 'GMT (UTC+0:00)';
    }
};

export const generateCalendarLinks = (appointment: {
    name: string;
    meetingType: string;
    date: string;
    time: string;
    meetingLink?: string;
}) => {
    // Helper to format date for calendar links
    const formatDateForLink = (dateStr: string, timeStr: string) => {
        // dateStr is YYYY-MM-DD
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);

        const [time, ampm] = timeStr.split(' ');
        const parts = time.split(':').map(Number);
        let hours = parts[0];
        const minutes = parts[1];

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        date.setHours(hours, minutes, 0);

        const end = new Date(date);
        end.setHours(date.getHours() + 1); // Default 1 hour duration

        const formatISO = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        return {
            start: formatISO(date),
            end: formatISO(end)
        };
    };

    const { start, end } = formatDateForLink(appointment.date, appointment.time);
    const title = encodeURIComponent(`${appointment.meetingType} with ${appointment.name}`);
    const location = encodeURIComponent(appointment.meetingLink || '');
    const details = encodeURIComponent(
        `Scheduled via SmartSchedule AI. Meeting Type: ${appointment.meetingType}${appointment.meetingLink ? `\nLocation/Link: ${appointment.meetingLink}` : ''}`
    );

    const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;

    const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${start}&enddt=${end}&body=${details}&location=${location}`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SmartSchedule AI//EN
BEGIN:VEVENT
UID:${Math.random().toString(36).substring(2)}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}
DTSTART:${start}
DTEND:${end}
SUMMARY:${appointment.meetingType} with ${appointment.name}
LOCATION:${appointment.meetingLink || ''}
DESCRIPTION:Scheduled via SmartSchedule AI. Meeting Type: ${appointment.meetingType}\\nLocation/Link: ${appointment.meetingLink || ''}
END:VEVENT
END:VCALENDAR`;

    return { googleLink, outlookLink, icsContent };
};
