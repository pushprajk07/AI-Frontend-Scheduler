import { MeetingType, AITone } from '../types';

export const getDefaultTone = (type: MeetingType): AITone => {
    switch (type) {
        case 'Demo':
            return 'Persuasive';
        case 'Interview':
            return 'Formal';
        case 'Consultation':
            return 'Friendly Professional';
        default:
            return 'Friendly Professional';
    }
};

export const generateAIContent = async (name: string, type: MeetingType, date: string, time: string, tone: AITone) => {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const content = {
        confirmationEmail: '',
        rescheduleMessage: '',
        cancellationMessage: '',
        reminderMessage: '',
        meetingAgenda: ''
    };

    if (tone === 'Persuasive') {
        content.confirmationEmail = `Subject: Revolutionize Your Workflow - Confirmation for Your ${type}\n\nDear ${name},\n\nI'm thrilled that you've scheduled a ${type} for ${date} at ${time}. You've taken the first step toward transforming how you manage your schedule. I can't wait to show you exactly how our solution can solve your specific challenges and drive results for your team.\n\nLooking forward to a productive session!\n\nBest regards,\nThe SmartSchedule AI Team`;
        content.rescheduleMessage = `Hi ${name}, I noticed we need to find a new time for our ${type}. Your time is valuable, and I want to ensure we don't miss the opportunity to discuss your goals. Let's get this back on the calendar for a time that works better for you!`;
        content.cancellationMessage = `Hello ${name}, I'm sorry to hear you've cancelled our ${type}. We were really looking forward to showing you the power of SmartSchedule AI. If your situation changes, please don't hesitate to reach out - we'd love to reconnect.`;
        content.reminderMessage = `Hi ${name}! Just a quick reminder about our ${type} tomorrow at ${time}. We've prepared some exciting insights tailored just for you. See you then!`;
        content.meetingAgenda = `1. Introduction & Goal Alignment (5 min)\n2. Interactive Feature Deep-Dive (15 min)\n3. Custom ROI Analysis for Your Team (10 min)\n4. Q&A and Strategic Next Steps (10 min)`;
    } else if (tone === 'Formal') {
        content.confirmationEmail = `Subject: Appointment Confirmation: ${type} - ${name}\n\nDear ${name},\n\nThis email serves as formal confirmation of your scheduled ${type} on ${date} at ${time}. We appreciate your interest and have reserved this time slot specifically for our discussion. Please ensure you are available at the scheduled time.\n\nSincerely,\nSmartSchedule Administration`;
        content.rescheduleMessage = `Dear ${name}, regarding our scheduled ${type}, circumstances require us to propose a reschedule. Please review your availability so we may finalize a new time for this important engagement.`;
        content.cancellationMessage = `Dear ${name}, we acknowledge the cancellation of your ${type} previously scheduled for ${date}. Your record has been updated accordingly. We remain at your disposal should you require our services in the future.`;
        content.reminderMessage = `Formal Reminder: Dear ${name}, this is to remind you of your ${type} scheduled for tomorrow, ${date}, at ${time}. We look forward to your punctual attendance.`;
        content.meetingAgenda = `1. Formal Introductions (5 min)\n2. Review of Background and Requirements (10 min)\n3. Detailed Discussion of ${type} Objectives (15 min)\n4. Evaluation and Technical Assessment (10 min)\n5. Concluding Remarks (5 min)`;
    } else {
        // Friendly Professional
        content.confirmationEmail = `Subject: You're all set! See you on ${date}\n\nHi ${name},\n\nThanks for booking a ${type}! I've got you down for ${date} at ${time}. I'm really looking forward to our chat and hearing more about what you're working on. If anything comes up before then, just let me know!\n\nCheers,\nThe SmartSchedule Team`;
        content.rescheduleMessage = `Hey ${name}, hope you're having a good day! It looks like we need to reschedule our ${type}. No worries at all - just let me know when you're free and we'll find another time that works for you.`;
        content.cancellationMessage = `Hi ${name}, just wanted to confirm that your ${type} has been cancelled. Sorry we won't get to connect this time, but hopefully we can catch up in the future!`;
        content.reminderMessage = `Hi ${name}, just a friendly reminder that we're meeting tomorrow at ${time} for our ${type}. Can't wait to connect!`;
        content.meetingAgenda = `1. Quick Catch-up & Context Setting (5 min)\n2. Collaborative Problem Solving (20 min)\n3. Brainstorming & Idea Exchange (10 min)\n4. Wrap-up & Action Items (5 min)`;
    }

    return content;
};
