import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiKeyAuth } from './middleware/apiKey';
import type { Bindings, Item, CreateItemBody, UpdateItemBody } from './types';

const NAME_MAX = 200;
const DESC_MAX = 1000;
const PRICE_MAX = 999_999;

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use('*', (c, next) =>
  cors({ origin: c.env.ALLOWED_ORIGIN })(c, next)
);

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

// POST /items — crear (requiere API key)
app.post('/items', apiKeyAuth, async (c) => {
  const body = await c.req.json<CreateItemBody>().catch(() => null);
  if (!body) return c.json({ error: 'Body inválido' }, 400);

  const { name, description = null, price } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return c.json({ error: 'name es requerido' }, 422);
  }
  if (name.length > NAME_MAX) {
    return c.json({ error: `name no puede superar ${NAME_MAX} caracteres` }, 422);
  }
  if (description !== null && description !== undefined && description.length > DESC_MAX) {
    return c.json({ error: `description no puede superar ${DESC_MAX} caracteres` }, 422);
  }
  if (typeof price !== 'number' || price < 0 || price > PRICE_MAX) {
    return c.json({ error: `price debe ser un número entre 0 y ${PRICE_MAX}` }, 422);
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO items (name, description, price) VALUES (?, ?, ?) RETURNING *'
  )
    .bind(name.trim(), description, price)
    .first<Item>();

  return c.json({ data: result }, 201);
});

// PUT /items/:id — actualizar (requiere API key)
app.put('/items/:id', apiKeyAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

  const body = await c.req.json<UpdateItemBody>().catch(() => null);
  if (!body) return c.json({ error: 'Body inválido' }, 400);

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return c.json({ error: 'name no puede estar vacío' }, 422);
    }
    if (body.name.length > NAME_MAX) {
      return c.json({ error: `name no puede superar ${NAME_MAX} caracteres` }, 422);
    }
  }
  if (body.description !== undefined && body.description !== null && body.description.length > DESC_MAX) {
    return c.json({ error: `description no puede superar ${DESC_MAX} caracteres` }, 422);
  }
  if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0 || body.price > PRICE_MAX)) {
    return c.json({ error: `price debe ser un número entre 0 y ${PRICE_MAX}` }, 422);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM items WHERE id = ?')
    .bind(id)
    .first<Item>();
  if (!existing) return c.json({ error: 'Item no encontrado' }, 404);

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  const description = body.description !== undefined ? body.description : existing.description;
  const price = body.price ?? existing.price;

  const updated = await c.env.DB.prepare(
    'UPDATE items SET name = ?, description = ?, price = ? WHERE id = ? RETURNING *'
  )
    .bind(name, description, price, id)
    .first<Item>();

  return c.json({ data: updated });
});

// DELETE /items/:id — eliminar (requiere API key)
app.delete('/items/:id', apiKeyAuth, async (c) => {
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
