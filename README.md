# Academia IRB®

Plataforma de cursos y prácticas guiadas de IRB® (reemplazo de LearnDash), desplegada en staging desde `main`. UI con el sistema visual **Rayo**: el lenguaje de [irbximena.com/v2](https://irbximena.com/v2) (noche índigo con rayo WebGL de fondo, Bodoni Moda + Hanken Grotesk, crema y oro, ángulos rectos) sobre la estructura de roles de Sinapsis.

- **Web:** Next.js 15 (App Router) · React 19 · TypeScript estricto · Tailwind v4 · Radix · Motion · TanStack Query.
- **Datos:** Postgres 16 + Drizzle (migraciones solo aditivas) · Redis 7 (caché, rate limit, presencia, colas BullMQ).
- **Tiempo real:** outbox de eventos → worker idempotente (XP, días de práctica, logros, círculos) → `LISTEN/NOTIFY` → SSE.
- **PWA:** Serwist, con recordatorios push opcionales (VAPID).

## Requisitos

- Node 22 o superior (con `corepack enable`; el gestor es **pnpm**, fijado en `packageManager`).
- Postgres 16 y Redis 7, locales o en Docker:

```bash
docker run -d --name irb-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker run -d --name irb-redis -p 6379:6379 redis:7
```

## Levantarlo en local

```bash
corepack enable
pnpm install
cp .env.example .env.local      # completa DATABASE_URL, REDIS_URL y APP_SECRET
# ejemplo: DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
#          REDIS_URL=redis://localhost:6379
#          APP_SECRET=$(openssl rand -hex 32)

set -a; . ./.env.local; set +a  # los scripts de la base leen el entorno
pnpm db:migrate                 # esquema + triggers de NOTIFY
pnpm db:seed:demo               # datos de demo 100 % ficticios
pnpm dev                        # http://localhost:4200
pnpm worker                     # en otra terminal: procesa eventos nuevos (XP, logros, recordatorios)
```

Para entrar, ve a `/entrar` y elige una alumna de demo (no hay contraseña). `/fuegos` es el enlace público de la práctica gratuita y no deja navegar al resto de la plataforma.

## Datos de demo

`pnpm db:seed:demo` **borra y recrea** todo el contenido de la base de `DATABASE_URL`. Para no romper una base con datos reales, se niega a correr si encuentra cursos importados o usuarias reales.

El seed crea:

- 30 alumnas inventadas (`alumna01@demo.test` … `alumna30@demo.test`);
- 4 cursos de muestra con módulos, más la práctica Fuegos;
- 45 días de historia, procesados con el mismo motor del worker: XP, días, metas, logros y el círculo de la semana;
- comentarios y notificaciones de ejemplo.

Las portadas se generan en la UI (degradado por curso + título + isotipo) cuando un curso no tiene imagen.

## Modo desarrollo sin servicios externos

- **Vimeo:** las clases con `playable_in_staging = false` muestran el póster con el aviso *"Video no autorizado en este dominio"*, nunca un iframe roto. Si el dominio no está autorizado en Vimeo, el reproductor espera 9 s y muestra el mismo aviso. Para probar el reproductor completo hace falta un dominio autorizado en la privacidad del video.
- **Sentry:** solo se carga si hay `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`.
- **Brevo:** no se usa en desarrollo.
- **Push:** sin claves VAPID, el worker no envía recordatorios.
- **IA:** sin `ANTHROPIC_API_KEY`, "Pregúntale a IRB" responde en modo extractivo con el texto de la clase.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en :4200 |
| `pnpm build` | Build de producción (`output: standalone`) |
| `pnpm start` | Sirve el build en 127.0.0.1:4200 |
| `pnpm build:worker` | Empaqueta el worker en `dist/worker.mjs` |
| `pnpm worker` | Worker en modo desarrollo (tsx) |
| `pnpm lint` | ESLint (TypeScript + reglas de hooks) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Playwright: cero errores de consola por ruta + kiosco de Fuegos |
| `pnpm db:generate` | Genera una migración Drizzle a partir de `src/db/schema.ts` (solo cambios **aditivos**) |
| `pnpm db:migrate` | Aplica migraciones y triggers |
| `pnpm db:seed:demo` | Carga los datos de demo |
| `pnpm session:token -- alumna01@demo.test` | JWT de sesión de una alumna de demo |

### Pruebas

```bash
npx playwright install chromium          # una vez
IRB_SESSION=$(pnpm -s session:token) BASE_URL=http://localhost:4200 pnpm test
```

## Reglas del proyecto

- Los componentes usan roles de color (`--sin-*`, `--irb-*`), nunca hex sueltos. Los valores de los roles viven en `src/app/rayo.css`, que se carga al final y manda sobre `globals.css` y `v3.css`. La crema (`--sin-primary`) es solo para acciones; el oro (`--irb-gold`) es el acento; el espectro (`--irb-spectrum`) marca estado y progreso.
- Titulares con `<Title>` (`src/components/rayo/title.tsx`): Bodoni, palabras que suben y remate en cursiva dorada. Portadas sin imagen: `<CoverArt>` dibuja el arte generativo de v2 según la intención del título.
- El fondo vivo (rayo WebGL, cursor, barra de espectro) está en `src/components/rayo/atmosphere.tsx`: animado en la app, quieto dentro de las clases (no compite con el video) y apagado con `prefers-reduced-motion`.
- Las migraciones son aditivas: no se borran ni renombran columnas.
- No cambiar el enlace del embudo FAM 2027 (`EVENT.href` en `src/components/player/nav.tsx`).
- Nada de blur (`backdrop-filter`) en listas largas ni carruseles.
- Sistema visual vivo en `/_design`.

## Despliegue

Staging se despliega solo desde `main`: el servidor revisa el repo cada 2 minutos y, si `main` cambió, hace pull, build, migraciones, reinicio y smoke test, con rollback automático si algo falla. Los cambios de UI entran por pull request a `main`, no editando en el servidor.
