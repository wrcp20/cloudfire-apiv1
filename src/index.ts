import { fromHono } from 'chanfana'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { apiKeyAuth } from './middleware/apiKey'
import {
  CategoriesCreate,
  CategoriesDelete,
  CategoriesGet,
  CategoriesList,
  CategoriesUpdate,
} from './routes/categories'
import { ItemsCreate, ItemsDelete, ItemsGet, ItemsList, ItemsUpdate } from './routes/items'
import { UsersCreate, UsersDelete, UsersGet, UsersList, UsersUpdate } from './routes/users'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('*', (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN })(c, next))

app.get('/', (c) => c.json({ name: 'cloudfire-apiv1', status: 'ok', version: '2.0.0' }))

app.on(['POST', 'PUT', 'DELETE'], '/*', apiKeyAuth)

const openapi = fromHono(app, {
  docs_url: '/docs',
  openapi_url: '/openapi.json',
  schema: {
    info: { title: 'cloudfire-apiv1', version: '2.0.0' },
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
  },
} as any) as any

openapi.get('/items', ItemsList)
openapi.get('/items/:id', ItemsGet)
openapi.post('/items', ItemsCreate)
openapi.put('/items/:id', ItemsUpdate)
openapi.delete('/items/:id', ItemsDelete)
openapi.get('/categories', CategoriesList)
openapi.get('/categories/:id', CategoriesGet)
openapi.post('/categories', CategoriesCreate)
openapi.put('/categories/:id', CategoriesUpdate)
openapi.delete('/categories/:id', CategoriesDelete)
openapi.get('/users', UsersList)
openapi.get('/users/:id', UsersGet)
openapi.post('/users', UsersCreate)
openapi.put('/users/:id', UsersUpdate)
openapi.delete('/users/:id', UsersDelete)

export default app
