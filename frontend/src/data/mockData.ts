import { Appointment } from '../types';
import { v4 as uuidv4 } from 'uuid';

const today = new Date();
const formatDate = (days: number) => {
    const d = new Date();
    d.setDate(today.getDate() + days);
    return d.toISOString().split('T')[0];
};

export const INITIAL_APPOINTMENTS: Appointment[] = [
    {
        id: uuidv4(),
        name: 'Sarah Jenkins',
        email: 'sarah.j@example.com',
        phone: '+1 (555) 123-4567',
        meetingType: 'Interview',
        date: formatDate(1),
        time: '10:00 AM',
        timezone: 'IST (GMT+5:30)',
        status: 'Scheduled',
        tone: 'Formal',
        confirmationEmail:
            'Subject: Appointment Confirmation: Interview - Sarah Jenkins\n\nDear Sarah,\n\nThis email serves as formal confirmation of your scheduled Interview on tomorrow at 10:00 AM. We appreciate your interest and have reserved this time slot specifically for our discussion.\n\nSincerely,\nSmartSchedule Administration',
        reminderMessage:
            'Formal Reminder: Dear Sarah, this is to remind you of your Interview scheduled for tomorrow at 10:00 AM. We look forward to your punctual attendance.',
        meetingAgenda:
            '1. Formal Introductions (5 min)\n2. Review of Background and Requirements (10 min)\n3. Detailed Discussion of Interview Objectives (15 min)\n4. Evaluation and Technical Assessment (10 min)\n5. Concluding Remarks (5 min)',
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        name: 'Michael Chen',
        email: 'm.chen@techcorp.com',
        phone: '+1 (555) 987-6543',
        meetingType: 'Demo',
        date: formatDate(2),
        time: '2:30 PM',
        timezone: 'IST (GMT+5:30)',
        status: 'Scheduled',
        tone: 'Persuasive',
        confirmationEmail:
            "Subject: Revolutionize Your Workflow - Confirmation for Your Demo\n\nDear Michael,\n\nI'm thrilled that you've scheduled a Demo for the day after tomorrow at 2:30 PM. You've taken the first step toward transforming how you manage your schedule.\n\nBest regards,\nThe SmartSchedule AI Team",
        reminderMessage:
            "Hi Michael! Just a quick reminder about our Demo tomorrow at 2:30 PM. We've prepared some exciting insights tailored just for you. See you then!",
        meetingAgenda:
            '1. Introduction & Goal Alignment (5 min)\n2. Interactive Feature Deep-Dive (15 min)\n3. Custom ROI Analysis for Your Team (10 min)\n4. Q&A and Strategic Next Steps (10 min)',
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        name: 'Alex Rivera',
        email: 'arivera@consulting.io',
        phone: '+1 (555) 444-5555',
        meetingType: 'Consultation',
        date: formatDate(-1),
        time: '9:00 AM',
        timezone: 'IST (GMT+5:30)',
        status: 'Completed',
        tone: 'Friendly Professional',
        confirmationEmail:
            "Subject: You're all set! See you on yesterday\n\nHi Alex,\n\nThanks for booking a Consultation! I'm really looking forward to our chat.\n\nCheers,\nThe SmartSchedule Team",
        reminderMessage:
            "Hi Alex, just a friendly reminder that we're meeting tomorrow at 9:00 AM for our Consultation. Can't wait to connect!",
        meetingAgenda:
            '1. Quick Catch-up & Context Setting (5 min)\n2. Collaborative Problem Solving (20 min)\n3. Brainstorming & Idea Exchange (10 min)\n4. Wrap-up & Action Items (5 min)',
        createdAt: new Date().toISOString()
    }
];
