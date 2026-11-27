# Despliegue independiente de The Point Company

Este sistema puede funcionar sin la cuenta suspendida de Manus. La aplicación usa React/Vite, Express/tRPC, Drizzle y MySQL. La autenticación principal es una sesión firmada por la propia aplicación con `THE_POINT_SHARED_PASSWORD` y `JWT_SECRET`; las variables `MANUS_*` quedan únicamente como compatibilidad heredada y no son necesarias.

## Flujo recomendado: GitHub + Railway + MySQL

1. Crear un proyecto nuevo en Railway y conectarlo al repositorio público `leonelgarciaceb12-arch/ThePointCompany`, rama `main`.
2. Agregar un servicio MySQL administrado dentro del mismo proyecto.
3. Configurar en el servicio de aplicación las variables `DATABASE_URL`, `THE_POINT_SHARED_PASSWORD`, `THE_POINT_EDITOR_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production` y `PORT=3000`. Railway permite referenciar la URL del servicio MySQL; no se deben guardar valores reales en GitHub.
4. Generar un dominio público para el servicio web. Railway usará `/api/health` para verificar que la aplicación está sana.
5. Activar el deploy automático desde `main`. Cada push aprobado dispara el workflow de GitHub; Railway construye el `Dockerfile`, ejecuta las migraciones idempotentes y publica la nueva versión solo si la imagen arranca correctamente.

El archivo `railway.json` ya contiene el builder Docker, el health check y la política de reinicio. La activación de Railway requiere una cuenta externa del propietario y no puede hacerse con credenciales inventadas desde el repositorio.

## Validación de cambios

GitHub Actions ejecuta en cada push y pull request:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
docker build .
```

La regla recomendada en GitHub es proteger `main` y exigir que el workflow `validate` termine correctamente antes de aceptar un pull request. Editar desde cualquier computadora consiste en modificar el repositorio, abrir un pull request y fusionarlo a `main`; Railway publica automáticamente el commit fusionado.

## Variables obligatorias

- `DATABASE_URL`: conexión MySQL/TiDB persistente.
- `THE_POINT_SHARED_PASSWORD`: contraseña de acceso de los socios.
- `THE_POINT_EDITOR_PASSWORD`: contraseña para operaciones que el sistema marque como editor.
- `JWT_SECRET`: secreto largo y aleatorio para firmar sesiones. No reutilizar la contraseña.
- `NODE_ENV=production`: activa cookies seguras HTTPS.
- `PORT=3000`: puerto interno del contenedor.

No configurar `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `MANUS_API_*`, `MANUS_OAUTH_API_URL` ni `MANUS_JWT_SECRET` en el despliegue nuevo. Las rutas heredadas no se usan cuando esas variables están ausentes.

## Base de datos y migraciones

El contenedor ejecuta `pnpm db:migrate` antes de iniciar el servidor. Las migraciones son idempotentes y se conservan en `drizzle/`. No ejecutar `db:push` contra producción. Para una base nueva, después de migrar se puede cargar el histórico versionado con:

```bash
pnpm db:seed
```

El despliegue independiente comienza vacío de forma intencional. No se incluye ni se carga el histórico completo de la cuenta anterior. Como excepción solicitada por el propietario, se conserva de forma privada la importación de las dos deudas pendientes de **Lucho** y **Leonel**. El archivo con esos datos está excluido de Git mediante `.gitignore` y no se publica en el repositorio. Cuando la base de Oracle esté disponible, se ejecuta una sola vez:

```bash
pnpm db:import-legacy-debts
```

El comando es idempotente: si las deudas ya existen, no las duplica. `pnpm db:seed` solo debe utilizarse si el propietario prepara explícitamente otra importación propia; la ausencia de un seed general es válida y no impide que la aplicación funcione.

## Backups independientes

El backup no debe quedar únicamente en el proveedor de hosting. Desde un equipo seguro con acceso a la base ejecutar:

```bash
pnpm db:backup -- --output ./backup-$(date -u +%Y%m%dT%H%M%SZ).json
```

Guardar el JSON y su SHA-256 en almacenamiento privado externo con retención diaria. Probar periódicamente una restauración en una base separada; `db:restore` requiere confirmación explícita y nunca debe apuntar a producción sin una copia previa.

Una alternativa operativa es programar un job externo (GitHub Actions privado, cron de un servidor propio o el scheduler del proveedor) con `DATABASE_URL` guardada como secreto. No subir backups ni archivos `.env` al repositorio.

## Recuperación ante pérdida del proveedor

El código está en GitHub, las migraciones son versionadas y los backups deben estar fuera de Railway. Para recuperar el sistema: crear una base MySQL nueva, configurar los secretos, desplegar el repositorio, ejecutar migraciones, restaurar el backup verificado y comprobar `/api/health` y el inicio de sesión.
