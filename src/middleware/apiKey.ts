import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '../types';

export const apiKeyAuth: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  const key = c.req.header('X-API-Key');

  if (!c.env.API_KEY) {
    return c.json({ error: 'API key no configurada en el servidor' }, 500);
  }

  if (!key || key !== c.env.API_KEY) {
    return c.json({ error: 'No autorizado' }, 401);
  }

  await next();
};
