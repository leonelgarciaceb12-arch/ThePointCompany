# The Point Company · Resultados del sistema

- [x] Base persistente compartida: la aplicación usa la base de datos administrada y queda preparada para que los dos socios accedan desde sus teléfonos mediante la sesión del proyecto.
- [x] Importación inicial: se cargaron los datos reales normalizados del Excel de Stock, Ventas, Clientes, Publicidad, Gastos, Préstamos y Objetivos sin rellenar faltantes con valores inventados.
- [x] Inventario: alta, edición de stock/costo/mínimo, proveedor y alertas de bajo stock; los productos con historial se archivan para preservar trazabilidad.
- [x] Ventas: venta desde inventario propio o manual; el inventario descuenta stock automáticamente, calcula costo/ganancia cuando el costo existe y marca «Costo pendiente» cuando falta.
- [x] Clientes: compras, gasto, ganancia, última compra, días sin recompra y selección de cliente existente al cargar una venta.
- [x] Dashboard: filtro de período, facturación, ganancia, margen, ticket promedio, unidades/pedidos, gastos, Meta Ads, deuda, rotación, bajo stock, clientes de mayor aporte y objetivo visible.
- [x] Gastos y publicidad: alta, edición, eliminación y métricas de inversión, conversaciones y resultados atribuidos desde la interfaz.
- [x] Deudores y préstamos: existen cuentas por cobrar separadas de préstamos/mercadería a pagar, con monto, pagos parciales, saldo, vencimiento, estado y formularios de alta/cobro.
- [x] Objetivos: objetivos mensuales importados, visibles, editables y eliminables desde la interfaz.
- [x] Acceso móvil: navegación, tablas con scroll y formularios responsive; auditoría básica con usuario y timestamps en registros.
- [x] Seguridad y consistencia: lecturas y escrituras del negocio requieren sesión; el dashboard evita duplicar ventas multi-línea y no presenta ganancias inventadas si falta costo.
- [x] Verificación: diagnóstico TypeScript, migraciones, build de producción, health check y manifiesto de rutas ejecutados correctamente.

- [x] Mantenimiento completo: editar y eliminar productos, ventas, clientes, gastos, publicidad, préstamos, deudores y objetivos desde la interfaz, con confirmación y preservación de historial cuando corresponda.
- [x] Cotización visible: ticker de dólar oficial, blue, MEP y CCL con compra/venta, actualización periódica, hora, fuente directa DolarHoy y fallback al último valor válido.
- [x] Métricas avanzadas: costo de mercadería vendida, resultado estimado, recompra, clientes vinculados, concentración de canales, mejor día, promedio diario, cobertura de stock y eficiencia de publicidad calculadas por período.
