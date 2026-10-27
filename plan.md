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


## Iteración de control y análisis avanzado

- **Mantenimiento de datos:** cada entidad visible tendrá edición protegida y eliminación confirmada. Las ventas ajustarán sus líneas y métricas; si una venta descontó inventario, eliminarla devolverá el stock. Los productos con historial se archivarán para no romper la trazabilidad.
- **Cotización:** el backend consultará periódicamente una fuente pública que replica cotizaciones de DolarHoy, mostrará dólar oficial, blue, MEP y CCL con compra/venta, hora de actualización y fuente visible. Si la fuente falla, se mostrará el último estado disponible/error sin inventar valores.
- **Métricas avanzadas:** sumar resultado estimado después de gastos y publicidad, costo de mercadería vendida, margen bruto, tasa de recompra, porcentaje de ventas con cliente, concentración por canal, mejor día, ingreso promedio diario, cobertura aproximada de stock y relación publicidad/facturación. Las métricas se calculan por el período seleccionado y distinguen los datos incompletos.
- **Interfaz:** agregar acciones de editar/eliminar en tablas y tarjetas, modales reutilizables, confirmación explícita antes de borrar, navegación para publicidad y objetivos, y un ticker de dólar siempre visible en el encabezado responsive.

## Iteración profesional vigente

Esta iteración conserva la arquitectura React/Express/tRPC/Drizzle y prioriza que cada dato sirva para decidir caja, rentabilidad, stock, cobranza y seguimiento comercial desde dos teléfonos.

- **Deudores:** usar vencimiento editable, estado vencido automático, pagos parciales y seguimiento visual. Corregir Francisco Rover a USD 186,33 con vencimiento 10/10/2026. Para Elias, reflejar USD 53,51 pagados y el saldo pendiente a 7 días desde 10/10/2026 cuando el total pueda verificarse en el historial.
- **Publicidad:** normalizar los registros existentes a `Campaña inicial propia de ventas - Multiples estilos`, eliminando fechas y la leyenda anterior. Mantener gasto real y mostrar N/A cuando no exista sincronización real con Meta Ads.
- **Clientes:** mostrar días sin comprar, etiqueta de seguimiento y botón directo a WhatsApp cuando exista teléfono, con un mensaje inicial editable por URL.
- **Proyecciones:** añadir una sección que calcule el siguiente mes usando el promedio diario/ritmo reciente y el crecimiento esperado configurable. Mostrar facturación, pedidos, ganancia bruta, resultado neto estimado, unidades y supuestos, separando proyección de dato real.
- **Cotización:** conservar DolarHoy y sumar una referencia USDT/ARS orientativa con fuente/hora, destacando USDT como tipo de cambio recomendado sin recalcular ventas históricas.
- **Datos operativos:** asegurar AirPods Pro 2 Gen (30 unidades, costo USD 8), Funda Silicone Case (197 unidades) y BC Create (costo USD 6,66), sin duplicar productos equivalentes.
- **Rendimiento/PWA:** evitar refetch innecesario al cambiar de pestaña, habilitar manifest standalone de plataforma, declarar rutas SPA y mantener el layout oscuro grafito fluido en mobile.

### Dirección visual de esta iteración

- **Movimiento:** Apple-style utility editorial: precisión sobria, superficies profundas, alto contraste controlado y jerarquía tipográfica fuerte.
- **Principios:** primero la decisión; datos reales antes que decoración; densidad progresiva; cada alerta tiene una acción.
- **Paleta:** grafito azulada (`#10171b`) en vez de negro puro para reducir fatiga; superficies `#172126`/`#1d2a30`; texto marfil; teal `#4fd1c5` como firma; verde para rentabilidad y ámbar/rojo sólo para riesgo.
- **Layout:** shell lateral en desktop y menú compacto en mobile; dashboard por capas de estado, tendencia y acción; tablas con overflow controlado.
- **Firmas:** monograma TP, ticker de cotización como cápsula superior, KPI con línea de estado y microcopy del supuesto.
- **Interacción y animación:** formularios cortos, toasts y enlaces de acción; transiciones de 160–220 ms, sin animaciones que retrasen la carga.
- **Tipografía y voz:** Inter para UI/datos y Georgia para titulares/cifras; microcopy directo: “Proyección, no promesa” y “Costo desconocido: no inventamos ganancia”.

### Estructura afectada

- `server/db.ts`: normalización idempotente, query de proyecciones, clientes sin recompra y cotización USDT con fallback.
- `server/routers.ts`: procedimiento protegido de proyecciones y contratos de vencimientos.
- `client/src/pages/Home.tsx`: vista de proyecciones, seguimiento comercial, WhatsApp y estados de cobranza.
- `client/src/index.css`: tema grafito, responsive y contención de tablas/gráficos.
- `client/public/manus-routes.json`: rutas SPA completas y sincronizadas.

Los cambios de datos se ejecutan de forma idempotente y no convierten costos faltantes en ganancias reales. La referencia USDT es informativa, no una integración de cobro ni asesoramiento financiero.

## Iteración de formularios y opciones reutilizables
- El frontend carga una consulta completa de inventario separada del filtro visual para que los formularios de venta y las sugerencias siempre dispongan de todos los productos activos.
- Los campos repetibles usan `datalist` y listas derivadas de la base compartida: categorías, clientes, canales, tipos/categorías de gastos, acreedores/proveedores, localidades, plataformas, campañas y meses. Las sugerencias aceleran la carga, pero no bloquean valores nuevos.
- Las listas se recalculan después de una mutación junto con el resto de las consultas, manteniendo intactos los registros existentes y el mismo flujo de persistencia tRPC/MySQL.

## Iteración de carga rápida de ventas
- El formulario de ventas expone la fecha como un campo editable con valor inicial en el día actual, permitiendo registrar ventas históricas sin cambiar la validación del backend.
- Clientes y productos se filtran en el navegador a medida que se escribe; las coincidencias exactas desde sugerencias quedan vinculadas al registro existente. Al seleccionar un cliente se copian automáticamente nombre y teléfono guardados.
- Se conserva el modo de venta manual para mercadería externa y el selector completo del inventario, de modo que la búsqueda acelera la carga sin bloquear nuevos datos.

## Importación y operación comercial ampliada
- La fuente histórica se limita a la hoja de Ventas del Excel; se conserva el rango mayo-octubre ya reconciliado por legacyId y se excluyen las demás hojas porque están desactualizadas.
- La base mantiene una única identidad de cliente por coincidencia exacta de teléfono normalizado o nombre normalizado; cada venta nueva resuelve o crea el cliente dentro de la misma transacción y refresca sus métricas.
- Los precios en ARS son una capa de captura: el backend recibe y guarda el total en USD convertido en frontend mediante USDT vivo, conservando el modelo financiero en USD.
- La navegación suma una vista Gráficos basada en las series reales del dashboard, con contención responsive para móvil.


## Integración Meta Ads · modo lectura

La sección Publicidad incorpora una capa separada para Meta Ads. El servidor consulta la cuenta RD ADS `1118607737611268` mediante Graph API, guarda insights por rango de 7 y 30 días y conserva niveles de cuenta, campaña y anuncio para no sumar Reach de forma incorrecta. El botón “Sincronizar ahora” no crea, edita, pausa ni modifica campañas: sólo actualiza gasto, impresiones, Reach, Link clicks, CTR, conversaciones iniciadas y costo por resultado. Los movimientos manuales permanecen separados y no se mezclan automáticamente con Ganancia neta hasta conciliar fechas y moneda. La credencial vive como secreto del proyecto; un access token inválido debe reemplazarse antes de la primera sincronización real.
