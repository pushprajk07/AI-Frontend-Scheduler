import { Hono, Context } from 'hono';
import prisma from '../client.ts';
import catchAsync from '../utils/catchAsync.ts';

const appointmentRoutes = new Hono();

appointmentRoutes.get('/', catchAsync(async (c: Context) => {
    const appointments = await prisma.appointment.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
    return c.json(appointments);
}));

appointmentRoutes.post('/', catchAsync(async (c: Context) => {
    const body = await c.req.json();
    
    // Explicitly remove id and isDeleted from body to avoid conflicts
    const { id, isDeleted, ...data } = body;
    
    // Ensure object fields are stringified if they come as objects from AI or frontend
    if (data.confirmationEmail && typeof data.confirmationEmail === 'object') {
        const { subject, body: emailBody } = data.confirmationEmail;
        data.confirmationEmail = `Subject: ${subject}\n\n${emailBody}`;
    }
    if (data.meetingAgenda && typeof data.meetingAgenda === 'object') {
        if (Array.isArray(data.meetingAgenda.agendaPoints)) {
            data.meetingAgenda = data.meetingAgenda.agendaPoints
                .map((p: any) => `${p.time}: ${p.description}`)
                .join('\n');
        } else {
            data.meetingAgenda = JSON.stringify(data.meetingAgenda);
        }
    }

    const appointment = await prisma.appointment.create({
        data: {
            ...data,
            isDeleted: false
        }
    });
    return c.json(appointment, 201);
}));

appointmentRoutes.patch('/:id', catchAsync(async (c: Context) => {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    
    const data = { ...body };
    if (data.confirmationEmail && typeof data.confirmationEmail === 'object') {
        const { subject, body: emailBody } = data.confirmationEmail;
        data.confirmationEmail = `Subject: ${subject}\n\n${emailBody}`;
    }
    if (data.meetingAgenda && typeof data.meetingAgenda === 'object') {
        if (Array.isArray(data.meetingAgenda.agendaPoints)) {
            data.meetingAgenda = data.meetingAgenda.agendaPoints
                .map((p: any) => `${p.time}: ${p.description}`)
                .join('\n');
        } else {
            data.meetingAgenda = JSON.stringify(data.meetingAgenda);
        }
    }

    const appointment = await prisma.appointment.update({
        where: { id, isDeleted: false },
        data
    });
    
    return c.json(appointment);
}));

appointmentRoutes.delete('/:id', catchAsync(async (c: Context) => {
    const id = parseInt(c.req.param('id'));
    
    await prisma.appointment.update({
        where: { id },
        data: { isDeleted: true }
    });
    
    return c.json({ success: true });
}));

export default appointmentRoutes;
