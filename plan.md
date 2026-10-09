# The Point Company · Plan de implementación

## Alcance de la primera versión

Construir una aplicación web interna, compartida y responsive para que los socios gestionen el negocio desde computadora o teléfono usando una única base de datos administrada. La primera versión prioriza el flujo que más impacto tiene hoy: cargar ventas, descontar inventario, calcular ganancia y detectar acciones comerciales. También incluye gastos, publicidad, clientes, deudores, préstamos/mercadería a pagar y objetivos.

El sistema toma como punto de partida el Excel existente, pero no trata el Excel como base de datos en producción. Se importarán los registros existentes a tablas relacionales, conservando los campos de origen y marcando los registros históricos cuando falte información suficiente para una conciliación perfecta.

## Arquitectura

- **Frontend:** React + TypeScript + Tailwind, con navegación responsive.
- **Backend:** Express + tRPC.
- **Persistencia:** MySQL administrado por Manus + Drizzle ORM.
- **Acceso:** Manus OAuth del starter, con el propietario y colaboradores autorizados por la visibilidad del proyecto; las mutaciones registran usuario y fecha.
- **Sincronización:** toda alta/edición se escribe en la base compartida; React Query invalida y refresca las consultas después de mutaciones. La primera versión usa actualización al volver a enfocar/recargar, dejando la puerta abierta a tiempo real.
- **Importación:** script de seed idempotente para cargar el Excel inicial sin duplicar por claves externas de origen.

## Entidades principales

- `products`: producto, categoría, proveedor, costo unitario, stock, stock mínimo, estado y notas.
- `sales` y `sale_items`: venta, cliente, socio, canal, fecha, estado, precio, costo, ganancia, y líneas vinculadas al inventario o manuales.
- `stock_movements`: compras, ajustes, ventas y devoluciones con cantidad y costo.
- `customers`: nombre, teléfono, localidad, notas, última compra y datos derivados.
- `expenses`: gastos generales y publicidad con categoría, fecha, monto, proveedor y notas.
- `ad_spend`: campaña, plataforma, gasto, conversaciones/resultados y notas.
- `debts`: deudores/clientes que deben pagar, monto original, pagos, saldo, vencimiento y estado.
- `loans`: préstamos o mercadería a pagar, acreedor, lote, moneda, total, pagos, vencimiento y alertas.
- `objectives`: metas mensuales de facturación, ganancia, pedidos y progreso.
- `import_sources`/campos de auditoría: referencia al origen Excel, creado por, actualizado por y timestamps.

## Flujos críticos

1. **Venta desde inventario:** seleccionar producto, cantidad, precio de venta y cliente opcional; validar stock disponible; crear venta y línea; crear movimiento negativo; recalcular stock, costo total, ganancia y margen.
2. **Venta manual:** cargar descripción, proveedor/origen, costo unitario opcional, cantidad y precio; no tocar el inventario propio si el usuario marca “mercadería externa”; calcular ganancia solo si existe costo.
3. **Reposición/ajuste:** seleccionar producto, sumar/restar cantidad, registrar motivo y costo; actualizar stock y valor de inventario.
4. **Clientes:** las ventas con cliente actualizan cantidad de compras, total gastado, última compra y ganancia generada. El dashboard muestra clientes sin recompra según umbral configurable.
5. **Préstamos/mercadería a pagar:** registrar total, pagos y vencimiento; calcular saldo y alertas de vencimiento próximo/vencido sin intereses por defecto.

## Dashboard

El inicio muestra período seleccionable y tarjetas de facturación, ganancia bruta, margen, unidades, ticket promedio, gastos y saldo por pagar. Debajo incluye gráfico de ventas/ganancia por día, categorías con más rotación, productos con stock bajo o inmovilizado, clientes de mayor aporte y tareas urgentes: vencimientos, seguimientos y cobros pendientes.

Las métricas distinguen siempre **facturación**, **ganancia bruta**, **gastos** y **resultado estimado**. Si falta costo o cliente, el sistema lo marca como dato incompleto en vez de inventarlo.

## Dirección de diseño

- **Movimiento:** dashboard editorial de operaciones, inspirado en una sala de control financiera compacta, no en un SaaS genérico lleno de tarjetas.
- **Principios:** claridad primero; números accionables; contraste entre dato y decisión; carga rápida desde móvil.
- **Color:** base carbón/crema para reducir ruido, azul petróleo como firma de The Point, verde solo para avance y rojo/ámbar únicamente para alertas reales.
- **Layout:** sidebar fija en desktop, navegación inferior compacta en móvil y una columna de “hoy” que prioriza acciones comerciales; tablas se convierten en tarjetas compactas en pantallas pequeñas.
- **Elementos distintivos:** indicador “Hoy”, chips de estado, línea vertical de actividad y tarjetas con borde lateral según tipo de acción.
- **Interacción:** formularios cortos con valores derivados en vivo; confirmación solo para acciones que modifican stock o deuda; toasts de guardado; filtros persistentes por período.
- **Animación:** transiciones suaves de 150–200 ms en paneles, sin animaciones decorativas que ralenticen la carga.
- **Tipografía:** Inter para datos y controles; una serif sobria solo para titulares de sección si está disponible, manteniendo legibilidad móvil.
- **Esencia de marca:** “El tablero que convierte mercadería, ventas y deudas en decisiones diarias.” Personalidad: directo, ordenado, realista.
- **Voz:** microcopy rioplatense y operativo: “Cargar venta”, “Qué hay que mover hoy”, “No confundas facturación con ganancia”.
- **Wordmark:** “THE POINT” en mayúsculas con un punto cuadrado como marca, acompañado por “Control de negocio”.
- **Color propio:** azul petróleo profundo, reservado para acciones primarias y foco de navegación.

## Estructura de proyecto

- `client/src/pages/Home.tsx`: shell de dashboard y navegación interna.
- `client/src/components/business/`: tarjetas, tablas, gráficos y formularios por dominio.
- `client/src/lib/format.ts`: fechas, moneda, porcentajes y estados.
- `server/routers.ts`: procedimientos tRPC de dashboard, productos, ventas, clientes, gastos, deudas, préstamos y objetivos.
- `server/db.ts`: consultas y transacciones de inventario/ventas.
- `drizzle/schema.ts`: tablas, tipos y relaciones.
- `scripts/import-excel.ts` y `data/seed.json`: importación reproducible del Excel real.
- `public/manus-routes.json`: manifiesto de rutas del sitio.

## Entrega y evolución

La primera versión queda preparada para: autenticación por socio, permisos, auditoría, sincronización más frecuente, exportación y conexión posterior con Gscalate o Meta Ads. No se automatiza Meta Ads en esta etapa: se deja el módulo para carga manual de publicidad y el dashboard para incorporar esos gastos y resultados sin mezclar métricas.
