import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AlertStore } from '../services/AlertStore.js';

const createSchema = z.object({
  symbol: z.string().default('XAUUSD'),
  target_price: z.number().positive(),
  trigger_condition: z.enum(['PRICE_REACHES', 'PRICE_ABOVE', 'PRICE_BELOW']),
});

const updateSchema = z.object({
  target_price: z.number().positive().optional(),
  trigger_condition: z.enum(['PRICE_REACHES', 'PRICE_ABOVE', 'PRICE_BELOW']).optional(),
  symbol: z.string().optional(),
});

export async function alertRoutes(app: FastifyInstance, store: AlertStore): Promise<void> {
  app.get('/api/alerts', async (req) => {
    const query = (req.query as any) || {};
    const status = query.status as string | undefined;
    const allowed = ['ACTIVE', 'TRIGGERED', 'DISABLED', 'ALL'] as const;
    const s = status && (allowed as readonly string[]).includes(status) ? (status as any) : 'ALL';
    return store.list(s);
  });

  app.get('/api/alerts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.getById(id);
    if (!alert || alert.status === 'DELETED') return reply.code(404).send({ error: 'Not found' });
    return alert;
  });

  app.post('/api/alerts', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const alert = store.create(parsed.data);
    return reply.code(201).send(alert);
  });

  app.patch('/api/alerts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = store.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'Not found' });
    return updated;
  });

  app.post('/api/alerts/:id/enable', async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.setStatus(id, 'ACTIVE');
    if (!alert) return reply.code(404).send({ error: 'Not found' });
    return alert;
  });

  app.post('/api/alerts/:id/disable', async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.setStatus(id, 'DISABLED');
    if (!alert) return reply.code(404).send({ error: 'Not found' });
    return alert;
  });

  app.post('/api/alerts/:id/reset', async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.getById(id);
    if (!alert) return reply.code(404).send({ error: 'Not found' });
    if (alert.status !== 'TRIGGERED') return reply.code(400).send({ error: 'Only TRIGGERED alerts can be reset' });
    const reset = store.setStatus(id, 'ACTIVE');
    return reset;
  });

  app.delete('/api/alerts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.getById(id);
    if (!alert) return reply.code(404).send({ error: 'Not found' });
    store.softDelete(id);
    return { ok: true };
  });
}
