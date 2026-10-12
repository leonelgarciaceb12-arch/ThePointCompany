# The Point Company · Resultados del sistema

- [x] Base persistente compartida: la aplicación usa la base de datos administrada y queda preparada para que los dos socios accedan desde sus teléfonos mediante la sesión del proyecto.
- [x] Importación inicial y actualización: se cargaron y reconciliaron los datos reales normalizados del Excel de Stock, Ventas, Clientes, Publicidad, Gastos, Préstamos y Objetivos sin rellenar faltantes con valores inventados; la última actualización dejó 332 ventas hasta el 10/10/2026 y 49 registros de publicidad.
- [x] Inventario: alta, edición de stock/costo/mínimo, proveedor y alertas de bajo stock; los productos con historial se archivan para preservar trazabilidad.
- [x] Ventas: venta desde inventario propio o manual; el inventario descuenta stock automáticamente, calcula costo/ganancia cuando el costo existe y marca «Costo pendiente» cuando falta.
- [x] Clientes: compras, gasto, ganancia, última compra, días sin recompra y selección de cliente existente al cargar una venta.
- [x] Dashboard: filtro de período, facturación, ganancia, margen, ticket promedio, unidades/pedidos, gastos, Meta Ads, deuda, rotación, bajo stock, clientes de mayor aporte y objetivo visible.
- [x] Gastos y publicidad: alta, edición y eliminación; la interfaz conserva el gasto verificado y muestra conversiones/resultados solo cuando exista sincronización real.
- [x] Deudores y préstamos: existen cuentas por cobrar separadas de préstamos/mercadería a pagar, con monto, pagos parciales, saldo, vencimiento, estado y formularios de alta/cobro.
- [x] Objetivos: objetivos mensuales importados, visibles, editables y eliminables desde la interfaz.
- [x] Acceso móvil: navegación, tablas con scroll y formularios responsive; auditoría básica con usuario y timestamps en registros.
- [x] Seguridad y consistencia: lecturas y escrituras del negocio requieren sesión; el dashboard evita duplicar ventas multi-línea y no presenta ganancias inventadas si falta costo.
- [x] Verificación: diagnóstico TypeScript, migraciones, build de producción, health check y manifiesto de rutas ejecutados correctamente.

- [x] Mantenimiento completo: editar y eliminar productos, ventas, clientes, gastos, publicidad, préstamos, deudores y objetivos desde la interfaz, con confirmación y preservación de historial cuando corresponda.
- [x] Cotización visible: ticker de dólar oficial, blue, MEP y CCL con compra/venta, actualización periódica, hora, fuente directa DolarHoy y fallback al último valor válido.
- [x] Métricas avanzadas: costo de mercadería vendida, resultado estimado, recompra, clientes vinculados, concentración de canales, mejor día, promedio diario, cobertura de stock y eficiencia de publicidad calculadas por período.

- [x] Ventas con doble origen: el formulario permite descripción manual y selección opcional de inventario; al guardar copia descripción, cantidad, precio, costo unitario, costo total y ganancia en la línea de venta, y el inventario solo se usa para descontar stock.

- [x] Pagos de ventas: al registrar una venta se puede elegir “Pago todo” o “No pago todo”; el monto cobrado se guarda y el saldo restante crea automáticamente una cuenta en Deudores vinculada al cliente.
- [x] Publicidad sin datos inventados: se quitó la carga manual de conversiones/resultados; mientras Meta Ads no esté sincronizado, la interfaz muestra N/A y conserva únicamente el gasto verificado.
- [x] Correcciones operativas: Funda Silicona (varios modelos) queda en 197 unidades, Elfbar Ebcreate Bc Pro 40k puff queda con costo unitario USD 6,66 y se registró Francisco Rover con deuda de USD 186,33.

- [x] Deudores: Francisco Rover queda con USD 186,33 y vencimiento 10/10/2026; Elias refleja USD 53,51 pagados y USD 70,09 pendientes con vencimiento 17/10/2026, sin duplicar cuentas. Préstamos y deudores calculan y muestran estados abierto, pago parcial, vencido o pagado.
- [x] Publicidad: todos los registros existentes muestran `Campaña inicial propia de ventas - Multiples estilos`, sin “estilo folleto” ni fecha en la descripción; la limpieza histórica es idempotente para frases heredadas y no agrega conversiones/resultados no sincronizados.
- [x] Clientes: cada cliente muestra días desde la última compra, estado de seguimiento y botón directo a WhatsApp cuando tiene teléfono; los teléfonos argentinos se convierten al formato internacional 549.
- [x] Proyecciones: la sección proyecta matemáticamente para el mes siguiente facturación, ganancia bruta, resultado neto estimado, pedidos, unidades y ritmo diario, mostrando crecimiento esperado y supuestos.
- [x] Cotización: DolarHoy permanece visible y destaca USDT como referencia recomendada, con valor USDT/ARS orientativo, fuente y hora, sin alterar históricos.
- [x] Correcciones de inventario y Excel vigente: AirPods Pro 2 Gen queda en 30 unidades con costo USD 8; el Excel más reciente fija Funda Silicona en 193 y BC Create con costo USD 6,66; se conservaron productos manuales adicionales para no borrar trazabilidad.
- [x] Experiencia: tema oscuro grafito no negro, gráficos y tablas encuadrados, altura/ancho de gráficos contenidos para todos los períodos, carga/refetch controlados y manifest instalable en modo standalone con ícono propio.
- [x] Ajuste operativo 11/10/2026: se eliminó del dashboard el gráfico de facturación y ganancia; la última venta de Benja Guillen por USD 49,68 quedó en estado pendiente y creó una cuenta por cobrar abierta; se eliminó el compromiso de Santiago López por estar pagado.
- [x] Dashboard financiero: mostrar Ganancia neta como ganancia bruta − Ads − gastos para cualquier período, con filtros Día corriente, Últimos 7 días, Últimos 30 días, Este mes, Último trimestre (90 días) y Todo el historial.
- [x] Compromisos y PWA: los compromisos tipo préstamo permiten tasa y periodicidad mensual/semanal; Mateo Portillo quedó al 40% mensual, Lucho al 5% mensual y Leonel Ceballos al 0% con vencimiento a un año; el resumen destaca Ganancia bruta y Ganancia neta; la app incluye opción visible Instalar app y service worker.
- [x] Ventas multiítem: el formulario permite agregar varias líneas de inventario o mercadería manual en una misma venta, calcula subtotales, descuenta cada stock y ancla el costo por producto; se registró la venta de Day por US$111,80 con 11 Elfbar Ebcreate Bc Pro 40k puff y 1 Elfbar Ice King 40k Puff.
