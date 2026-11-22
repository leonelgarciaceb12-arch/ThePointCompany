# Operación y mantenimiento

## Arquitectura

La interfaz es React/Vite/TypeScript. El servidor es Express con tRPC y Drizzle ORM. La persistencia principal es MySQL/TiDB. `server/db.ts` contiene las operaciones transaccionales de ventas, inventario, clientes, gastos y compromisos.

## Migraciones

Las migraciones viven en `drizzle/` y se ejecutan con `pnpm db:migrate`. La migración `0010_good_lizard.sql` es aditiva: crea `product_flavors` y agrega `sale_items.flavorId`. No crea sabores históricos ni modifica cantidades existentes.

## Publicidad

La regla canónica es `category=Publicidad`, `type=Meta Ads`, `description=Publicidad`. Los honorarios de `Publicista` siguen siendo gastos operativos. La normalización histórica se puede inspeccionar con `pnpm db:normalize-meta-ads --dry-run` y aplicar con `pnpm db:normalize-meta-ads`.

## Backups

El endpoint administrado por Manus guarda snapshots JSON en storage. La programación esperada es `0 59 23 * * *` en `America/Argentina/Buenos_Aires` (23:59 ART). Para backup local: `pnpm db:backup ./backups/archivo.json`. Para restaurar hay que usar explícitamente `pnpm db:restore ./backups/archivo.json --confirm`; la restauración reemplaza las tablas incluidas y debe hacerse sobre una base detenida o previamente respaldada.

El backup pre-refactor válido está fuera del repositorio, protegido con permisos 600: `/home/ubuntu/pointdesk-backups/the-point-company-pre-refactor-20261122T025337Z.json`.

## Dependencias Manus

La autenticación OAuth/JWT, storage de backups y algunas variables `BUILT_IN_FORGE_*` dependen del entorno Manus. Para ejecutar localmente se puede usar la sesión por contraseña compartida y MySQL/Docker, pero OAuth y storage gestionado no son portables automáticamente.
