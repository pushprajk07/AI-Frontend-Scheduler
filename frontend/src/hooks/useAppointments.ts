import { useState, useEffect, useCallback } from 'react';
import { Appointment } from '../types';
import { appointmentService } from '../services/appointment.service';

export const useAppointments = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAppointments = useCallback(async () => {
        try {
            setLoading(true);
            const data = await appointmentService.getAll();
            setAppointments(data);
        } catch (error) {
            console.error('Failed to fetch appointments', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const addAppointment = async (appointment: Partial<Appointment>) => {
        try {
            const newApp = await appointmentService.create(appointment);
            setAppointments(prev => [newApp, ...prev]);
            return newApp;
        } catch (error) {
            console.error('Failed to add appointment', error);
            throw error;
        }
    };

    const updateAppointment = async (id: string | number, updates: Partial<Appointment>) => {
        try {
            const updated = await appointmentService.update(id, updates);
            setAppointments(prev => prev.map(app => (app.id === id ? updated : app)));
            return updated;
        } catch (error) {
            console.error('Failed to update appointment', error);
            throw error;
        }
    };

    const deleteAppointment = async (id: string | number) => {
        try {
            await appointmentService.delete(id);
            setAppointments(prev => prev.filter(app => app.id !== id));
        } catch (error) {
            console.error('Failed to delete appointment', error);
            throw error;
        }
    };

    return {
        appointments,
        loading,
        addAppointment,
        updateAppointment,
        deleteAppointment,
        refresh: fetchAppointments
    };
};
