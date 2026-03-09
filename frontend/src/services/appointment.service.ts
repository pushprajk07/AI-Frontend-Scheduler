import api from '../lib/api';
import { Appointment } from '../types';

export const appointmentService = {
    getAll: async (): Promise<Appointment[]> => {
        const response = await api.get('/appointments');
        return response.data;
    },

    create: async (appointment: Partial<Appointment>): Promise<Appointment> => {
        const response = await api.post('/appointments', appointment);
        return response.data;
    },

    update: async (id: string | number, updates: Partial<Appointment>): Promise<Appointment> => {
        const response = await api.patch(`/appointments/${id}`, updates);
        return response.data;
    },

    delete: async (id: string | number): Promise<{ success: boolean }> => {
        const response = await api.delete(`/appointments/${id}`);
        return response.data;
    }
};
