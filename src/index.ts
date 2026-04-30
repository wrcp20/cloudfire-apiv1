import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Bindings, Item, CreateItemBody, UpdateItemBody } from './types';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use('*', cors());

app.get('/', (c) => {
  return c.json({ name: 'cloudfire-apiv1', status: 'ok', version: '1.0.0' });
});

// GET /items — listar todos
app.get('/items', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM items ORDER BY created_at DESC'
  ).all<Item>();
  return c.json({ data: results, count: results.length });
});

// GET /items/:id — obtener uno
app.get('/items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

  const item = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?')
    .bind(id)
    .first<Item>();

  if (!item) return c.json({ error: 'Item no encontrado' }, 404);
  return c.json({ data: item });
});

// POST /items — crear
app.post('/items', async (c) => {
  const body = await c.req.json<CreateItemBody>().catch(() => null);
  if (!body) return c.json({ error: 'Body inválido' }, 400);

  const { name, description = null, price } = body;
  if (!name || typeof price !== 'number') {
    return c.json({ error: 'name y price son requeridos' }, 422);
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO items (name, description, price) VALUES (?, ?, ?) RETURNING *'
  )
    .bind(name, description, price)
    .first<Item>();

  return c.json({ data: result }, 201);
});

// PUT /items/:id — actualizar
app.put('/items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

  const body = await c.req.json<UpdateItemBody>().catch(() => null);
  if (!body) return c.json({ error: 'Body inválido' }, 400);

  const existing = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?')
    .bind(id)
    .first<Item>();
  if (!existing) return c.json({ error: 'Item no encontrado' }, 404);

  const name = body.name ?? existing.name;
  const description = body.description !== undefined ? body.description : existing.description;
  const price = body.price ?? existing.price;

  const updated = await c.env.DB.prepare(
    'UPDATE items SET name = ?, description = ?, price = ? WHERE id = ? RETURNING *'
  )
    .bind(name, description, price, id)
    .first<Item>();

  return c.json({ data: updated });
});

// DELETE /items/:id — eliminar
app.delete('/items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM items WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) return c.json({ error: 'Item no encontrado' }, 404);

  await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
  return c.json({ message: 'Item eliminado' });
});

export default app;
