# The Point Company · Control de negocio

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.
- `pnpm db:seed`: reconciliación inicial idempotente.
- `pnpm db:backup` / `pnpm db:restore <archivo> --confirm`: backup y restauración JSON.
- `pnpm db:normalize-meta-ads --dry-run`: previsualizar la normalización de publicidad; sin `--dry-run` la aplica.

El código fuente público está en [github.com/leonelgarciaceb12-arch/ThePointCompany](https://github.com/leonelgarciaceb12-arch/ThePointCompany). Cualquiera puede verlo y clonarlo; para escribir directamente se necesita acceso de colaborador o trabajar mediante fork/pull request.

Las variantes de inventario están disponibles para `Vapes Descartables`, `Vapers Descartables` y `Esencias`. Cada sabor mantiene stock propio, el stock total del producto se sincroniza con sus sabores activos y las ventas descuentan/devolucionan la variante elegida. El despliegue nuevo comienza vacío y no carga datos históricos; los registros se guardan desde ahora en la base MySQL persistente. La operación detallada está en `docs/OPERATIONS.md` y las variables locales en `.env.example`.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Despliegue independiente

El proyecto no necesita la cuenta de Manus para ejecutarse: usa MySQL, autenticación propia por contraseña compartida y `JWT_SECRET`. Incluye `railway.json` y un workflow de validación en `.github/workflows/ci.yml`. Conecta la rama `main` a un servicio Docker de Railway y configura los secretos de `.env.example`; cada cambio validado puede publicarse automáticamente.

La guía completa de configuración, migraciones, recuperación y backups está en [docs/INDEPENDENT-DEPLOYMENT.md](docs/INDEPENDENT-DEPLOYMENT.md).
