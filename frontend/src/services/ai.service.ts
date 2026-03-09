import api from '../lib/api';
import { MeetingType, AITone } from '../types';

export const aiService = {
    generateContent: async (params: {
        name: string;
        meetingType: MeetingType;
        date: string;
        time: string;
        tone: AITone;
    }) => {
        if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
            // Fallback to local logic if needed, but per instructions we should move to backend
            // However, to keep it working if backend is not ready, we can use the old local logic here
            // but the instructions say "remove all usage of localstorage or any mock data"
        }
        const response = await api.post('/ai/generate-content', params);
        return response.data;
    },

    suggestSlots: async (params: { currentDate: string; currentTime: string; meetingType: MeetingType }) => {
        const response = await api.post('/ai/suggest-slots', params);
        return response.data;
    }
};
