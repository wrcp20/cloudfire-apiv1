# cloudfire-apiv1

API REST de pruebas construida con **Hono**, **D1 (SQLite)** y **TypeScript** desplegada en **Cloudflare Workers** (free tier).

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| [Hono](https://hono.dev) | ^4.7 | Router / framework HTTP |
| [Cloudflare Workers](https://workers.cloudflare.com) | — | Runtime serverless (edge) |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | — | Base de datos SQLite en edge |
| TypeScript | ^5.8 | Lenguaje |
| Wrangler | ^4.86 | CLI de Cloudflare |

## URL live

```
https://cloudfire-apiv1.wrcp20.workers.dev
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/items` | Lista todos los items |
| `GET` | `/items/:id` | Obtiene un item por ID |
| `POST` | `/items` | Crea un nuevo item |
| `PUT` | `/items/:id` | Actualiza un item (parcial) |
| `DELETE` | `/items/:id` | Elimina un item |

### Esquema de Item

```json
{
  "id": 1,
  "name": "Laptop Lenovo",
  "description": "ThinkPad X1 Carbon",
  "price": 1299.99,
  "created_at": "2026-04-30 12:52:21"
}
```

### Ejemplos con curl

```bash
# Health check
curl https://cloudfire-apiv1.wrcp20.workers.dev/

# Listar todos los items
curl https://cloudfire-apiv1.wrcp20.workers.dev/items

# Obtener item por ID
curl https://cloudfire-apiv1.wrcp20.workers.dev/items/1

# Crear item
curl -X POST https://cloudfire-apiv1.wrcp20.workers.dev/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Monitor Samsung", "description": "27 pulgadas 4K", "price": 499.99}'

# Actualizar item (campos opcionales)
curl -X PUT https://cloudfire-apiv1.wrcp20.workers.dev/items/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 449.99}'

# Eliminar item
curl -X DELETE https://cloudfire-apiv1.wrcp20.workers.dev/items/1
```

---

## Estructura del proyecto

```
apiv1/
├── src/
│   ├── index.ts          # App Hono con todas las rutas
│   └── types.ts          # Interfaces TypeScript (Item, Bindings, etc.)
├── migrations/
│   └── 0001_init.sql     # Schema inicial de la tabla items
├── wrangler.toml         # Configuración de Cloudflare Workers + D1
├── tsconfig.json         # Configuración de TypeScript
├── package.json          # Dependencias y scripts
└── .gitignore
```

---

## Configuración de Cloudflare

### Cuenta y recursos

| Recurso | Valor |
|---|---|
| Account ID | `fed835a88054981371bdc3d428e25dc9` |
| Worker name | `cloudfire-apiv1` |
| D1 database name | `cloudfire-db` |
| D1 database ID | `42cb9c6b-eb30-4c5d-bc6f-507481060cd1` |
| Worker URL | `https://cloudfire-apiv1.wrcp20.workers.dev` |

### wrangler.toml explicado

```toml
name = "cloudfire-apiv1"          # nombre del worker en Cloudflare
main = "src/index.ts"             # entry point
compatibility_date = "2025-04-30" # versión de runtime fijada
compatibility_flags = ["nodejs_compat"]  # habilita APIs de Node.js

[[d1_databases]]
binding = "DB"                    # nombre del binding en el código (c.env.DB)
database_name = "cloudfire-db"    # nombre de la DB en Cloudflare
database_id = "42cb9c6b-eb30-4c5d-bc6f-507481060cd1"
migrations_dir = "migrations"     # carpeta con archivos SQL de migraciones
```

---

## Comandos de Wrangler (Cloudflare CLI)

### Instalación y autenticación

```bash
# Instalar wrangler globalmente
npm install -g wrangler

# Verificar versión
wrangler --version

# Autenticarse con Cloudflare (abre el browser)
wrangler login

# Verificar cuenta autenticada y permisos
wrangler whoami
```

### D1 Database

```bash
# Crear una nueva base de datos D1
wrangler d1 create cloudfire-db

# Listar todas las bases de datos D1 de la cuenta
wrangler d1 list

# Ver info de una base de datos específica
wrangler d1 info cloudfire-db

# Aplicar migraciones al D1 REMOTO (recomendado, funciona en Windows)
wrangler d1 migrations apply cloudfire-db --remote

# Listar migraciones ya aplicadas en remoto
wrangler d1 migrations list cloudfire-db --remote

# Ejecutar una query SQL directamente en remoto
wrangler d1 execute cloudfire-db --command "SELECT * FROM items" --remote

# Ejecutar un archivo SQL directamente en remoto
wrangler d1 execute cloudfire-db --file ./seed.sql --remote

# ⚠️ ADVERTENCIA Windows: el flag --local FALLA en Windows (crash miniflare)
# wrangler d1 migrations apply cloudfire-db --local  ← NO usar en Windows
```

### Workers: deploy y monitoreo

```bash
# Deployar el worker a Cloudflare
wrangler deploy

# Ver logs en tiempo real del worker desplegado
wrangler tail

# Desarrollo local (⚠️ puede fallar en Windows con D1)
wrangler dev

# Ver versiones deployadas
wrangler versions list

# Rollback a una versión anterior
wrangler rollback
```

### Scripts de npm (atajos)

```bash
npm run dev               # wrangler dev (servidor local)
npm run deploy            # wrangler deploy
npm run db:migrate:remote # wrangler d1 migrations apply cloudfire-db --remote
npm run db:migrate:local  # wrangler d1 migrations apply cloudfire-db --local
npm run typecheck         # tsc --noEmit (verificar tipos sin compilar)
```

---

## Comandos de Git

### Setup inicial (ya realizado)

```bash
# Inicializar repositorio local
git init

# Crear y cambiar a la rama de trabajo
git checkout -b feat/hono-d1-api

# Agregar archivos al staging
git add package.json tsconfig.json wrangler.toml .gitignore src/ migrations/

# Primer commit
git commit -m "feat(api): initial Hono + D1 CRUD API on Cloudflare Workers"

# Agregar remote de GitHub
git remote add origin https://github.com/wrcp20/cloudfire-apiv1.git

# Push con tracking de upstream
git push -u origin feat/hono-d1-api
```

### Flujo de trabajo diario

```bash
# Ver estado actual del repo
git status

# Ver diferencias de los cambios actuales
git diff

# Stagear cambios específicos
git add src/index.ts

# Stagear todos los cambios rastreados
git add -u

# Commit con mensaje descriptivo (Conventional Commits)
git commit -m "feat(items): add pagination support"
git commit -m "fix(items): handle null description on update"
git commit -m "chore(deps): update hono to 4.8.0"

# Push a la rama actual
git push

# Pull de cambios remotos
git pull origin feat/hono-d1-api
```

### Ramas y merges

```bash
# Ver todas las ramas (local y remota)
git branch -a

# Crear y cambiar a nueva rama
git checkout -b fix/nombre-del-fix

# Cambiar entre ramas
git checkout feat/hono-d1-api

# Merge de rama a main (después de PR aprobado)
git checkout main
git merge --no-ff feat/hono-d1-api

# Eliminar rama local ya mergeada
git branch -d feat/hono-d1-api

# Eliminar rama remota
git push origin --delete feat/hono-d1-api
```

### Historial y revisión

```bash
# Ver historial de commits (compacto)
git log --oneline --graph

# Ver cambios de un commit específico
git show <commit-hash>

# Ver quién cambió cada línea de un archivo
git blame src/index.ts
```

---

## Comandos de GitHub CLI (gh)

### Repositorio

```bash
# Crear repositorio en GitHub (público)
gh repo create cloudfire-apiv1 --public --description "API de pruebas con Hono + D1 + TypeScript"

# Crear repositorio privado
gh repo create cloudfire-apiv1 --private

# Ver repositorio actual en el browser
gh repo view --web

# Clonar un repositorio
gh repo clone wrcp20/cloudfire-apiv1
```

### Pull Requests

```bash
# Crear un PR desde la rama actual
gh pr create \
  --title "feat(api): initial Hono + D1 CRUD API" \
  --body "Descripción del PR con los cambios realizados" \
  --base main

# Crear PR en modo draft
gh pr create --draft --title "WIP: nueva feature"

# Listar PRs abiertos
gh pr list

# Ver estado de checks/CI de un PR
gh pr checks

# Ver PR en el browser
gh pr view --web

# Aprobar y mergear un PR
gh pr merge --squash

# Cerrar un PR sin mergear
gh pr close <numero>
```

### Issues

```bash
# Crear un issue
gh issue create --title "Bug: endpoint /items falla con ID negativo" --body "Descripción..."

# Listar issues abiertos
gh issue list

# Cerrar un issue
gh issue close <numero>
```

### Acciones y releases

```bash
# Ver runs de GitHub Actions
gh run list

# Ver logs de un run específico
gh run view <run-id> --log

# Crear un release
gh release create v1.0.0 --title "v1.0.0" --notes "Release inicial"
```

---

## Setup desde cero (para clonar y reproducir)

```bash
# 1. Clonar el repositorio
gh repo clone wrcp20/cloudfire-apiv1
cd cloudfire-apiv1

# 2. Instalar dependencias
npm install

# 3. Autenticarse con Cloudflare
wrangler login

# 4. Crear tu propia D1 database (o reutilizar si tienes acceso)
wrangler d1 create cloudfire-db
# → Actualizar database_id en wrangler.toml con el ID generado

# 5. Aplicar migraciones
wrangler d1 migrations apply cloudfire-db --remote

# 6. Deployar
wrangler deploy
```

---

## Free tier de Cloudflare — Límites

| Servicio | Límite gratuito |
|---|---|
| Workers requests | 100,000 / día |
| Workers CPU time | 10ms por request |
| D1 reads | 5,000,000 / día |
| D1 writes | 100,000 / día |
| D1 storage | 5 GB total |
| Workers size | 1 MB (comprimido) |

---

## Notas importantes

- **Windows + `--local`**: el flag `--local` de wrangler crashea en Windows con D1 (bug conocido de miniflare). Siempre usar `--remote` para migraciones y queries directas.
- **`wrangler dev` en Windows**: puede tener problemas con el runtime local de D1. Si falla, testear directamente contra el worker deployado.
- **`RETURNING *`**: D1 soporta la cláusula `RETURNING` en INSERT/UPDATE/DELETE para obtener la fila afectada en una sola query.
- **Binding**: el binding `DB` en `wrangler.toml` se accede en el código como `c.env.DB` (en Hono) o `env.DB` (en fetch handler nativo).
