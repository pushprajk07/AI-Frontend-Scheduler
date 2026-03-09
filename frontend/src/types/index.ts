export type MeetingType = 'Demo' | 'Interview' | 'Consultation' | 'Online' | 'Offline';

export type AppointmentStatus = 'Scheduled' | 'Cancelled' | 'Completed';

export type AITone = 'Persuasive' | 'Formal' | 'Friendly Professional';

export interface Appointment {
    id: string | number;
    name: string;
    email: string;
    phone: string;
    meetingType: MeetingType;
    date: string; // ISO string
    time: string;
    timezone?: string;
    status: AppointmentStatus;
    confirmationEmail?: string;
    rescheduleMessage?: string;
    cancellationMessage?: string;
    reminderMessage?: string;
    meetingAgenda?: string;
    tone?: AITone;
    duration?: string;
    meetingLink?: string;
    meetingId?: string;
    location?: string;
    createdAt: string;
}
