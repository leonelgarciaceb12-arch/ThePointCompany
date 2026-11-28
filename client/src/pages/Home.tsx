import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  FilePlus2,
  Gauge,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Megaphone,
  Menu,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const money = (value: unknown, currency = "USD") =>
  `${currency === "USD" ? "US$" : "$"}${Number(value ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value: unknown) => Number(value ?? 0).toLocaleString("es-AR");
const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const dateKeyInArgentina = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const dateInput = (value?: unknown) =>
  value ? String(value).slice(0, 10) : "";
const dateLabel = (value?: unknown) => {
  const date = dateInput(value);
  return date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      })
    : "—";
};
const flavorCategory = (category?: unknown) => ["Vapes Descartables", "Vapers Descartables", "Esencias", "Silicone Cases", "Body Splash"].includes(String(category || ""));
const whatsappUrl = (phone?: unknown, name?: unknown) => {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("54"))
    digits = digits.startsWith("549") ? digits : `549${digits.slice(2)}`;
  else digits = `549${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hola ${name || ""}, ¿cómo estás? Te escribo de The Point para saber si necesitás reponer mercadería.`)}`;
};
const debtState = (item: any) => {
  const balance = Number(item?.balance || 0);
  const paid = Number(item?.paid || 0);
  if (balance <= 0) return { label: "Pagado", className: "ok" };
  const due = dateInput(item?.dueDate);
  if (due && new Date(`${due}T23:59:59`) < new Date())
    return { label: "Vencido", className: "danger" };
  if (paid > 0) return { label: "Pago parcial", className: "warn" };
  return { label: "Abierto", className: "soft" };
};
function DebtStatusTag({ item }: { item: any }) {
  const status = debtState(item);
  return (
    <span
      className={`status-tag ${status.className === "soft" ? "soft-status" : status.className}`}
    >
      {status.label}
    </span>
  );
}
const today = dateKeyInArgentina();
const confirmDelete = (label: string) =>
  window.confirm(
    `¿Eliminar ${label}? Esta acción no se puede deshacer. Las ventas con historial pueden afectar métricas y stock.`
  );

const uniqueOptions = (values: unknown[]) =>
  Array.from(
    new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "es"));
type SuggestedInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  listId: string;
  placeholder?: string;
  autoFocus?: boolean;
};
function SuggestedInput({
  label,
  value,
  onChange,
  options,
  listId,
  placeholder,
  autoFocus = false,
}: SuggestedInputProps) {
  const values = uniqueOptions([...options, value]);
  return (
    <label>
      {label}
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {values.map(option => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

const nav = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "sales", label: "Ventas", icon: ShoppingCart },
  { id: "inventory", label: "Inventario", icon: Boxes },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "finance", label: "Finanzas", icon: Wallet },
  { id: "ads", label: "Publicidad", icon: Megaphone },
  { id: "projections", label: "Proyecciones", icon: TrendingUp },
];
const periodOptions = [
  { value: "today", label: "Día corriente" },
  { value: "7d", label: "Semana · últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "month", label: "Mes · corriente" },
  { value: "quarter", label: "Trimestre · últimos 90 días" },
  { value: "all", label: "Todo el historial" },
] as const;
type PeriodKey = (typeof periodOptions)[number]["value"];
const periodLabel = (period: string) =>
  periodOptions.find(option => option.value === period)?.label || period;

function MetricCard({
  label,
  value,
  helper,
  tone = "blue",
  icon: Icon,
  delta,
  featured = false,
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
  icon: any;
  delta?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`metric-card ${tone} ${featured ? "metric-card-featured" : ""}`}
    >
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="metric-foot">
        {delta && (
          <span className={delta.startsWith("+") ? "positive" : "negative"}>
            {delta.startsWith("+") ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            {delta}
          </span>
        )}
        <small>{helper}</small>
      </div>
    </div>
  );
}
function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <div className="row-actions">
      <button
        className="icon-button small-icon"
        title="Editar"
        onClick={onEdit}
      >
        <Pencil size={14} />
      </button>
      <button
        className="icon-button small-icon danger-icon"
        title="Eliminar"
        onClick={() => {
          if (confirmDelete(deleteLabel)) onDelete();
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
function DollarTicker() {
  const rates = trpc.business.dollarRates.useQuery(undefined, {
    refetchInterval: 300000,
    staleTime: 240000,
  });
  const shown = rates.data?.rates ?? [];
  const usdt = rates.data?.usdt;
  return (
    <div
      className="dollar-ticker"
      title={`${rates.data?.source || "Cotización dólar"}. USDT es una referencia orientativa. Actualización automática cada 5 minutos.`}
    >
      <a
        className="ticker-source"
        href={rates.data?.sourceUrl || "https://dolarhoy.com/"}
        target="_blank"
        rel="noreferrer"
      >
        DÓLAR HOY
      </a>
      <span className="ticker-rate usdt-rate">
        <b>USDT</b>
        <small>{usdt ? money(usdt.price, "ARS") : "—"}</small>
      </span>
      {shown.map((r: any) => (
        <span className="ticker-rate ticker-secondary" key={r.casa}>
          <b>
            {r.casa === "bolsa"
              ? "MEP"
              : r.casa === "contadoconliqui"
                ? "CCL"
                : r.casa === "oficial"
                  ? "Oficial"
                  : "Blue"}
          </b>
          <small>
            C {money(r.compra, "ARS")} · V {money(r.venta, "ARS")}
          </small>
        </span>
      ))}
      {rates.data?.updatedLabel && (
        <span className="ticker-updated">
          {rates.data.stale ? "Desactualizado" : rates.data.updatedLabel}
        </span>
      )}
      {!shown.length && !usdt && (
        <span className="ticker-loading">Cotización no disponible</span>
      )}
    </div>
  );
}

function SaleForm({
  products,
  customers,
  customerNameOptions,
  channelOptions,
  onClose,
  onDone,
}: {
  products: any[];
  customers: any[];
  customerNameOptions: string[];
  channelOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  type SaleLine = {
    productId: string;
    flavorId: string;
    quantity: string;
    description: string;
    unitPrice: string;
    unitCost: string;
    priceCurrency: "USD" | "ARS";
    priceArs: string;
  };
  const emptyLine = (): SaleLine => ({
    productId: "",
    flavorId: "",
    quantity: "1",
    description: "",
    unitPrice: "",
    unitCost: "",
    priceCurrency: "USD",
    priceArs: "",
  });
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [saleDate, setSaleDate] = useState(today);
  const [productSearch, setProductSearch] = useState<Record<number, string>>(
    {}
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState("WhatsApp");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial">(
    "paid"
  );
  const [paidAmount, setPaidAmount] = useState("");
  const rates = trpc.business.dollarRates.useQuery(undefined, {
    refetchInterval: 300000,
    staleTime: 240000,
  });
  const usdtRate = Number(rates.data?.usdt?.price || 0);
  const flavors = trpc.business.allProductFlavors.useQuery(undefined, { staleTime: 60000 });
  const createSale = trpc.business.createSale.useMutation({
    onSuccess: r => {
      toast.success(
        r.balance > 0
          ? `Venta guardada · queda ${money(r.balance)} en Deudores`
          : r.costKnown
            ? `Venta guardada · ganancia ${money(r.profit)}`
            : "Venta guardada · costo pendiente"
      );
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const prepared = lines.map(line => {
    const selected = products.find(p => String(p.id) === line.productId);
    const fromInventory = Boolean(selected);
    const quantity = Math.max(0, Number(line.quantity || 0));
    const unitPrice =
      line.priceCurrency === "ARS"
        ? usdtRate > 0
          ? Math.max(0, Number(line.priceArs || 0)) / usdtRate
          : 0
        : Math.max(0, Number(line.unitPrice || 0));
    const unitCost = fromInventory
      ? Number(selected.cost || 0)
      : Number(line.unitCost || 0);
    const selectedFlavor = flavors.data?.find(f => String(f.id) === line.flavorId && f.productId === selected?.id);
    return { line, selected, selectedFlavor, fromInventory, quantity, unitPrice, unitCost };
  });
  const filteredCustomers = customers.filter(customer =>
    `${customer.name} ${customer.phone || ""}`
      .toLocaleLowerCase("es-AR")
      .includes(customerSearch.trim().toLocaleLowerCase("es-AR"))
  );
  const visibleProducts = (index: number) => {
    const query = (productSearch[index] || "")
      .trim()
      .toLocaleLowerCase("es-AR");
    const selectedId = lines[index]?.productId;
    return products.filter(product => {
      const matchesQuery =
        !query ||
        `${product.name} ${product.category || ""}`
          .toLocaleLowerCase("es-AR")
          .includes(query);
      return matchesQuery || String(product.id) === selectedId;
    });
  };
  const total = prepared.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const totalCost = prepared.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );
  const costKnown = prepared.every(
    item => item.fromInventory || item.line.unitCost !== ""
  );
  const profit = total - totalCost;
  const paid =
    paymentStatus === "paid" ? total : Math.min(total, Number(paidAmount || 0));
  const balance = Math.max(0, total - paid);
  const updateLine = (index: number, patch: Partial<SaleLine>) =>
    setLines(current =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  const selectProduct = (index: number, value: string) => {
    const product = products.find(p => String(p.id) === value);
    updateLine(index, {
      productId: value,
      flavorId: "",
      description: product ? product.name : "",
      unitCost: product ? String(product.cost) : "",
    });
    setProductSearch(current => ({
      ...current,
      [index]: product?.name || "",
    }));
  };
  const selectCustomer = (id: string) => {
    const customer = customers.find(item => String(item.id) === id);
    setCustomerId(id);
    if (customer) {
      setCustomerName(customer.name);
      setPhone(customer.phone || "");
      setCustomerSearch(customer.name);
    }
  };
  return (
    <Modal title="Cargar venta" onClose={onClose} wide>
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          if (!lines.length || prepared.some(item => item.quantity < 1))
            return toast.error("Cada línea debe tener una cantidad válida");
          if (
            prepared.some(
              item => item.line.priceCurrency === "ARS" && usdtRate <= 0
            )
          )
            return toast.error(
              "No hay cotización USDT disponible para convertir el precio en pesos"
            );
          if (
            prepared.some(
              item => !item.selected && !item.line.description.trim()
            )
          )
            return toast.error(
              "Completá la descripción de cada mercadería externa"
            );
          if (paymentStatus === "partial" && !customerName.trim())
            return toast.error("Indicá el cliente que queda como deudor");
          if (prepared.some(item => item.selected && flavorCategory(item.selected.category) && (!item.selectedFlavor || item.quantity > Number(item.selectedFlavor.stock))))
            return toast.error("Seleccioná un sabor válido y no superes su stock disponible");
          createSale.mutate({
            date: saleDate,
            channel,
            customerId: customerId ? Number(customerId) : undefined,
            customerName: customerName || undefined,
            customerPhone: phone || undefined,
            paymentStatus,
            paidAmount: paid,
            items: prepared.map(item => ({
              productId: item.selected?.id,
              flavorId: item.selectedFlavor?.id,
              description: item.line.description.trim() || item.selected.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost:
                !item.fromInventory && item.line.unitCost !== ""
                  ? Number(item.line.unitCost)
                  : undefined,
              fromInventory: item.fromInventory,
            })),
          });
        }}
      >
        <div className="form-grid">
          <label>
            Fecha de la venta
            <input
              type="date"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
              required
            />
          </label>
          <div className="data-note">
            <strong>Fecha histórica permitida</strong>
            <small>
              Podés cargar ventas de cualquier día, no solamente de hoy.
            </small>
          </div>
        </div>
        <div className="sale-source-note">
          <strong>Productos de la venta</strong>
          <small>
            Agregá varias líneas del inventario o mercadería externa. Cada
            producto propio descuenta stock y conserva su costo histórico.
          </small>
        </div>
        <div className="sale-lines">
          {lines.map((line, index) => {
            const selected = prepared[index].selected;
            const fromInventory = Boolean(selected);
            return (
              <div className="sale-line" key={index}>
                <div className="sale-line-head">
                  <strong>Ítem {index + 1}</strong>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() =>
                        setLines(current =>
                          current.filter((_, i) => i !== index)
                        )
                      }
                    >
                      <Trash2 size={13} /> Quitar
                    </button>
                  )}
                </div>
                <label>
                  Buscar producto del inventario{" "}
                  <span className="muted">
                    (podés escribir nombre o categoría)
                  </span>
                  <input
                    value={productSearch[index] || ""}
                    onChange={e => {
                      const value = e.target.value;
                      setProductSearch(current => ({
                        ...current,
                        [index]: value,
                      }));
                      const product = products.find(
                        item =>
                          item.name.trim().toLocaleLowerCase("es-AR") ===
                          value.trim().toLocaleLowerCase("es-AR")
                      );
                      if (product) selectProduct(index, String(product.id));
                    }}
                    list={`sale-products-${index}`}
                    placeholder="Ej. AirPods, perfumes, JBL..."
                  />
                  <datalist id={`sale-products-${index}`}>
                    {products.map(product => (
                      <option key={product.id} value={product.name} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Producto seleccionado{" "}
                  <span className="muted">
                    (opcional · opciones del inventario)
                  </span>
                  <select
                    value={line.productId}
                    onChange={e => selectProduct(index, e.target.value)}
                  >
                    <option value="">Venta manual / mercadería externa</option>
                    {visibleProducts(index).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.stock} disponibles · costo {money(p.cost)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Descripción manual
                  <input
                    value={line.description}
                    onChange={e =>
                      updateLine(index, { description: e.target.value })
                    }
                    placeholder={
                      selected
                        ? `Ej. ${selected.name} · color o presentación`
                        : "Ej. Pasamanos de otro proveedor"
                    }
                  />
                </label>
                {selected && flavorCategory(selected.category) && (
                  <label>
                    Sabor / variante
                    <select value={line.flavorId} onChange={e => updateLine(index, { flavorId: e.target.value })}>
                      <option value="">Seleccioná un sabor</option>
                      {(flavors.data || []).filter(f => f.productId === selected.id).map(f => <option key={f.id} value={f.id}>{f.name} · {f.stock} disponibles</option>)}
                    </select>
                    {prepared[index].selectedFlavor && <small className="conversion-note">Stock disponible: {prepared[index].selectedFlavor.stock} unidades</small>}
                  </label>
                )}
                <div className="form-grid">
                  <label>
                    Cantidad
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={e =>
                        updateLine(index, { quantity: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Moneda del precio
                    <select
                      value={line.priceCurrency}
                      onChange={e =>
                        updateLine(index, {
                          priceCurrency: e.target.value as "USD" | "ARS",
                        })
                      }
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">Pesos argentinos</option>
                    </select>
                  </label>
                  <label>
                    Precio unitario ({line.priceCurrency})
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        line.priceCurrency === "ARS"
                          ? line.priceArs
                          : line.unitPrice
                      }
                      onChange={e =>
                        updateLine(
                          index,
                          line.priceCurrency === "ARS"
                            ? { priceArs: e.target.value }
                            : { unitPrice: e.target.value }
                        )
                      }
                      placeholder={
                        line.priceCurrency === "ARS" ? "Ej. 15000" : "0.00"
                      }
                    />
                  </label>
                </div>
                {line.priceCurrency === "ARS" && (
                  <small className="conversion-note">
                    {usdtRate > 0
                      ? `Conversión automática: ${money(prepared[index].unitPrice)} por unidad · USDT ${money(usdtRate, "ARS")}`
                      : "Cotización USDT no disponible; actualizá la pantalla antes de guardar."}
                  </small>
                )}
                {!fromInventory && (
                  <label>
                    Costo unitario opcional
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitCost}
                      onChange={e =>
                        updateLine(index, { unitCost: e.target.value })
                      }
                      placeholder="Vacío si todavía no lo sabés"
                    />
                  </label>
                )}
                <small className="sale-line-total">
                  Subtotal:{" "}
                  <strong>
                    {money(
                      prepared[index].quantity * prepared[index].unitPrice
                    )}
                  </strong>
                </small>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="button secondary add-sale-line"
          onClick={() => setLines(current => [...current, emptyLine()])}
        >
          <Plus size={15} /> Agregar otro producto
        </button>
        <div className="form-grid">
          <label>
            Buscar cliente existente
            <input
              value={customerSearch}
              onChange={e => {
                const value = e.target.value;
                setCustomerSearch(value);
                const normalized = value.trim().toLocaleLowerCase("es-AR");
                const customer = customers.find(item => {
                  const name = item.name.trim().toLocaleLowerCase("es-AR");
                  const phoneValue = String(item.phone || "")
                    .trim()
                    .toLocaleLowerCase("es-AR");
                  return (
                    normalized === name ||
                    (phoneValue && normalized === phoneValue)
                  );
                });
                if (customer) selectCustomer(String(customer.id));
              }}
              list="sale-customers"
              placeholder="Nombre o teléfono"
            />
            <datalist id="sale-customers">
              {customers.map(customer => (
                <option key={customer.id} value={customer.name} />
              ))}
            </datalist>
          </label>
          <label>
            Cliente existente
            <select
              value={customerId}
              onChange={e => selectCustomer(e.target.value)}
            >
              <option value="">Sin vincular / nuevo</option>
              {filteredCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone || "sin teléfono"} · {c.purchases} compras
                </option>
              ))}
            </select>
          </label>
          <SuggestedInput
            label="Nombre / WhatsApp"
            value={customerName}
            onChange={value => {
              setCustomerName(value);
              const linked = customers.find(x => String(x.id) === customerId);
              if (linked && linked.name !== value) setCustomerId("");
            }}
            options={customerNameOptions}
            listId="sale-customer-names"
            placeholder="Nombre"
          />
        </div>
        <label>
          Teléfono
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="WhatsApp"
          />
        </label>
        <label>
          Canal
          <select value={channel} onChange={e => setChannel(e.target.value)}>
            {channelOptions.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="sale-payment">
          <span className="eyebrow">Cobro de la venta</span>
          <div className="segmented">
            <button
              type="button"
              className={paymentStatus === "paid" ? "active" : ""}
              onClick={() => setPaymentStatus("paid")}
            >
              Pago todo
            </button>
            <button
              type="button"
              className={paymentStatus === "partial" ? "active" : ""}
              onClick={() => setPaymentStatus("partial")}
            >
              No pago todo
            </button>
          </div>
          {paymentStatus === "partial" && (
            <label>
              Monto que sí pagó
              <input
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
          )}
          <small>
            {balance > 0
              ? `Se guardará ${money(balance)} en Deudores${customerName ? ` a nombre de ${customerName}` : ""}.`
              : "No queda saldo pendiente."}
          </small>
        </div>
        <div className={`live-result ${!costKnown ? "pending" : ""}`}>
          <span>Resultado estimado</span>
          <strong>{costKnown ? money(profit) : "Costo pendiente"}</strong>
          <small>
            {money(total)} facturación ·{" "}
            {costKnown
              ? `${total ? ((profit / total) * 100).toFixed(1) : "0.0"}% margen · costos anclados al guardar`
              : "La ganancia se calculará cuando cargues los costos"}
          </small>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={createSale.isPending}>
            {createSale.isPending ? "Guardando..." : "Guardar venta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SaleEditForm({
  sale,
  products,
  customers,
  customerNameOptions,
  channelOptions,
  onClose,
  onDone,
}: {
  sale: any;
  products: any[];
  customers: any[];
  customerNameOptions: string[];
  channelOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  type EditableSaleItem = {
    productId: string;
    flavorId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    unitCost: string;
    fromInventory: boolean;
  };
  const initialItems = Array.isArray(sale.items) && sale.items.length
    ? sale.items.map((item: any) => ({
        productId: item.productId ? String(item.productId) : "",
        flavorId: item.flavorId ? String(item.flavorId) : "",
        description: item.description || "",
        quantity: String(item.quantity || 1),
        unitPrice: String(item.unitPrice ?? 0),
        unitCost: String(item.unitCost ?? 0),
        fromInventory: Boolean(item.fromInventory),
      }))
    : [{
        productId: "",
        description: sale.notes || "Venta manual",
        quantity: "1",
        unitPrice: String(sale.total ?? 0),
        unitCost: String(sale.totalCost ?? 0),
        fromInventory: false,
      }];
  const [items, setItems] = useState<EditableSaleItem[]>(initialItems);
  const flavors = trpc.business.allProductFlavors.useQuery(undefined, { staleTime: 60000 });
  const [editProductSearch, setEditProductSearch] = useState<Record<number, string>>({});
  const [date, setDate] = useState(dateInput(sale.saleDate));
  const [customerId, setCustomerId] = useState(sale.customerId ? String(sale.customerId) : "");
  const [customerName, setCustomerName] = useState(sale.customerName || "");
  const [phone, setPhone] = useState(sale.customerPhone || "");
  const [channel, setChannel] = useState(sale.channel || "WhatsApp");
  const [status, setStatus] = useState(sale.status === "paid" ? "paid" : "pending");
  const [costKnown, setCostKnown] = useState(sale.costKnown !== false);
  const [description, setDescription] = useState(sale.notes || "");
  const update = trpc.business.updateSale.useMutation({
    onSuccess: () => {
      toast.success("Venta actualizada completa");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const updateItem = (index: number, patch: Record<string, unknown>) =>
    setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  const visibleEditProducts = (index: number) => {
    const query = (editProductSearch[index] || "").trim().toLocaleLowerCase("es-AR");
    const selectedId = items[index]?.productId;
    return products.filter(product => !query || `${product.name} ${product.category || ""}`.toLocaleLowerCase("es-AR").includes(query) || String(product.id) === selectedId);
  };
  const computedTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const computedCost = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
  return (
    <Modal title="Editar venta completa" onClose={onClose} wide>
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          if (!items.length || items.some(item => Number(item.quantity) < 1 || !item.description.trim())) {
            toast.error("Cada ítem necesita descripción y cantidad válida");
            return;
          }
          update.mutate({
            id: sale.id,
            date,
            customerId: customerId ? Number(customerId) : null,
            customerName: customerName || undefined,
            customerPhone: phone || undefined,
            channel,
            status: status as "paid" | "pending",
            total: computedTotal,
            totalCost: computedCost,
            costKnown,
            description: description || undefined,
            items: items.map(item => ({
              productId: item.productId ? Number(item.productId) : undefined,
              flavorId: item.flavorId ? Number(item.flavorId) : undefined,
              description: item.description.trim(),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice || 0),
              unitCost: costKnown ? Number(item.unitCost || 0) : 0,
              fromInventory: Boolean(item.fromInventory && item.productId),
            })),
          });
        }}
      >
        <div className="form-grid">
          <label>Fecha<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Canal<select value={channel} onChange={e => setChannel(e.target.value)}>{channelOptions.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Estado de pago<select value={status} onChange={e => setStatus(e.target.value)}><option value="paid">Pago todo</option><option value="pending">A pagar / deudor</option></select></label>
        </div>
        <div className="sale-source-note"><strong>Ítems editables</strong><small>Podés cambiar producto, descripción, cantidad, precio y costo. Si cambiás un producto del inventario, el stock se recalcula.</small></div>
        <div className="sale-lines">
          {items.map((item, index) => (
            <div className="sale-line" key={index}>
              <div className="sale-line-head"><strong>Ítem {index + 1}</strong>{items.length > 1 && <button type="button" className="text-button danger-text" onClick={() => setItems(current => current.filter((_, i) => i !== index))}><Trash2 size={13} /> Quitar</button>}</div>
              <label>Buscar producto del inventario<input value={editProductSearch[index] || ""} onChange={e => setEditProductSearch(current => ({ ...current, [index]: e.target.value }))} list={`edit-sale-products-${index}`} placeholder="Escribí nombre o categoría" /><datalist id={`edit-sale-products-${index}`}>{products.map(product => <option key={product.id} value={product.name} />)}</datalist></label>
              <label>Producto del inventario<select value={item.productId} onChange={e => {
                const value = e.target.value;
                const product = products.find(p => String(p.id) === value);
                updateItem(index, { productId: value, flavorId: "", fromInventory: Boolean(product), description: product?.name || item.description, unitCost: product ? String(product.cost) : item.unitCost });
              }}><option value="">Venta manual / externa</option>{visibleEditProducts(index).map(product => <option key={product.id} value={product.id}>{product.name} · stock {product.stock}</option>)}</select></label>
              {products.find(p => String(p.id) === item.productId) && (flavorCategory(products.find(p => String(p.id) === item.productId)?.category) || (flavors.data || []).some(f => f.productId === Number(item.productId))) && <label>Variante<select value={item.flavorId} onChange={e => updateItem(index, { flavorId: e.target.value })}><option value="">Seleccioná una variante</option>{(flavors.data || []).filter(f => f.productId === Number(item.productId)).map(f => <option key={f.id} value={f.id}>{f.name} · {f.stock} disponibles</option>)}</select></label>}
              <div className="form-grid">
                <label>Descripción<input value={item.description} onChange={e => updateItem(index, { description: e.target.value })} /></label>
                <label>Cantidad<input type="number" min="1" step="1" value={item.quantity} onChange={e => updateItem(index, { quantity: e.target.value })} /></label>
              </div>
              <div className="form-grid">
                <label>Precio unitario USD<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(index, { unitPrice: e.target.value })} /></label>
                <label>Costo unitario USD<input type="number" min="0" step="0.01" value={item.unitCost} disabled={!costKnown} onChange={e => updateItem(index, { unitCost: e.target.value })} /></label>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="button secondary" onClick={() => setItems(current => [...current, { productId: "", flavorId: "", description: "", quantity: "1", unitPrice: "", unitCost: "", fromInventory: false }])}><Plus size={15} /> Agregar ítem</button>
        <div className="mini-kpis"><div><span>Total recalculado</span><strong>{money(computedTotal)}</strong></div><div><span>Costo total</span><strong>{costKnown ? money(computedCost) : "Pendiente"}</strong></div><div><span>Ganancia</span><strong>{costKnown ? money(computedTotal - computedCost) : "Pendiente"}</strong></div></div>
        <label className="check-line"><input type="checkbox" checked={costKnown} onChange={e => setCostKnown(e.target.checked)} /> Confirmo que los costos están cargados</label>
        <label>Nota / descripción general<input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción opcional" /></label>
        <div className="form-grid">
          <label>Cliente<select value={customerId} onChange={e => { const id = e.target.value; setCustomerId(id); const c = customers.find(x => String(x.id) === id); if (c) { setCustomerName(c.name); setPhone(c.phone || ""); } }}><option value="">Sin vincular</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <SuggestedInput label="Nombre / WhatsApp" value={customerName} onChange={setCustomerName} options={customerNameOptions} listId="sale-edit-customer-names" />
        </div>
        <label>Teléfono<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={update.isPending}>{update.isPending ? "Guardando…" : "Guardar cambios completos"}</button></div>
      </form>
    </Modal>
  );
}
function ProductForm({
  product,
  categoryOptions,
  onClose,
  onDone,
}: {
  product?: any;
  categoryOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || "Perfumes");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [cost, setCost] = useState(String(product?.cost ?? ""));
  const [minStock, setMinStock] = useState(String(product?.minStock ?? 3));
  const create = trpc.business.createProduct.useMutation({
    onSuccess: () => {
      toast.success("Producto agregado al inventario");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.business.updateProduct.useMutation({
    onSuccess: () => {
      toast.success("Producto actualizado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      category,
      stock: Number(stock),
      cost: Number(cost),
      minStock: Number(minStock),
    };
    product
      ? update.mutate({ id: product.id, ...input })
      : create.mutate(input);
  };
  return (
    <Modal
      title={product ? "Editar producto" : "Agregar producto"}
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={save}>
        <label>
          Producto
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre del producto"
          />
        </label>
        <div className="form-grid">
          <SuggestedInput
            label="Categoría"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            listId="product-categories"
            placeholder="Elegí una existente o escribí una nueva"
          />
          <label>
            Stock actual
            <input
              type="number"
              min="0"
              value={stock}
              onChange={e => setStock(e.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Costo unitario
            <input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={e => setCost(e.target.value)}
            />
          </label>
          <label>
            Alertar debajo de
            <input
              type="number"
              min="0"
              value={minStock}
              onChange={e => setMinStock(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={create.isPending || update.isPending}
          >
            {product ? "Guardar cambios" : "Agregar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ExpenseForm({
  expense,
  categoryOptions,
  typeOptions,
  onClose,
  onDone,
}: {
  expense?: any;
  categoryOptions: string[];
  typeOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const isEditing = Boolean(expense?.id);
  const isAdvertising = Boolean(
    expense?.isAdvertising ||
      expense?.category === "Publicidad" ||
      expense?.type === "Publicitario" ||
      expense?.type === "Meta Ads" ||
      expense?.platform === "Meta Ads"
  );
  const [date, setDate] = useState(dateInput(expense?.expenseDate) || today);
  const [category, setCategory] = useState(isAdvertising ? "Publicidad" : expense?.category || "Operativo");
  const [description, setDescription] = useState(isAdvertising ? "Publicidad" : expense?.description || "");
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [type, setType] = useState(isAdvertising ? "Meta Ads" : expense?.type || "Operativo");
  const [notes, setNotes] = useState(expense?.notes || "");
  const create = trpc.business.createExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto registrado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.business.updateExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto actualizado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Modal
      title={isEditing ? "Editar gasto" : "Registrar gasto"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          const input = {
            date,
            category: isAdvertising ? "Publicidad" : category,
            description: isAdvertising ? "Publicidad" : description,
            amount: Number(amount),
            type: isAdvertising ? "Meta Ads" : type,
            notes: notes || undefined,
          };
          isEditing
            ? update.mutate({ id: expense.id, ...input })
            : create.mutate(input);
        }}
      >
        <div className="form-grid">
          <label>
            Fecha
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>
          <label>
            Tipo
            {isAdvertising ? (
              <input value="Meta Ads" disabled />
            ) : (
              <select value={type} onChange={e => setType(e.target.value)}>
                {typeOptions.map(option => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            )}
          </label>
        </div>
        <SuggestedInput
          label="Categoría"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          listId="expense-categories"
          placeholder="Elegí una existente o escribí una nueva"
        />
        {isAdvertising ? (
          <div className="data-note">
            <strong>Gasto publicitario</strong>
            <small>La descripción se guarda como Publicidad y no se muestra como detalle.</small>
          </div>
        ) : (
          <label>
            Descripción
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="¿En qué se gastó?"
            />
          </label>
        )}
        <label>
          Monto
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>
        <label>
          Notas
          <input value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            {expense ? "Guardar cambios" : "Guardar gasto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function LoanForm({
  loan,
  counterpartyOptions,
  onClose,
  onDone,
}: {
  loan?: any;
  counterpartyOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState(loan?.kind || "payable_merch");
  const [counterparty, setCounterparty] = useState(loan?.counterparty || "");
  const [description, setDescription] = useState(
    loan?.description || loan?.notes || ""
  );
  const [principal, setPrincipal] = useState(String(loan?.principal ?? ""));
  const [repayment, setRepayment] = useState(
    String(loan?.repaymentAmount ?? loan?.principal ?? "")
  );
  const [paid, setPaid] = useState(String(loan?.paid ?? 0));
  const [interestRate, setInterestRate] = useState(
    String(loan?.interestRate ?? 0)
  );
  const [interestUnit, setInterestUnit] = useState(
    loan?.interestUnit || "percent"
  );
  const [interestPeriod, setInterestPeriod] = useState(
    loan?.interestPeriod || "monthly"
  );
  const [interestStartDate, setInterestStartDate] = useState(
    dateInput(loan?.interestStartDate)
  );
  const [interestBase, setInterestBase] = useState(
    loan?.interestBase || "initial_principal"
  );
  const [installmentCount, setInstallmentCount] = useState(
    String(loan?.installmentCount ?? "")
  );
  const [installmentAmount, setInstallmentAmount] = useState(
    String(loan?.installmentAmount ?? "")
  );
  const [installmentPeriod, setInstallmentPeriod] = useState(
    loan?.installmentPeriod || "weekly"
  );
  const [hasDueDate, setHasDueDate] = useState(loan?.hasDueDate !== false);
  const [dueDate, setDueDate] = useState(dateInput(loan?.dueDate));
  const [startDate, setStartDate] = useState(
    dateInput(loan?.startDate) || today
  );
  const create = trpc.business.createLoan.useMutation({
    onSuccess: () => {
      toast.success("Compromiso registrado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.business.updateLoan.useMutation({
    onSuccess: () => {
      toast.success("Compromiso actualizado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const isLoan = kind === "loan";
  const computedInstallment =
    Number(installmentCount) > 0
      ? Number(repayment || 0) / Number(installmentCount)
      : 0;
  return (
    <Modal
      title={loan ? "Editar compromiso" : "Nuevo compromiso"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          const input = {
            kind: kind as "loan" | "payable_merch" | "internal",
            counterparty,
            description: description || undefined,
            interestRate: Number(interestRate),
            interestUnit: interestUnit as "percent" | "usd",
            interestPeriod: interestPeriod as "daily" | "monthly" | "weekly",
            interestStartDate: interestStartDate || undefined,
            interestBase: interestBase as "initial_principal" | "active_balance",
            principal: Number(principal),
            repaymentAmount: isLoan
              ? Number(repayment || principal)
              : undefined,
            installmentCount:
              isLoan && Number(installmentCount) > 0
                ? Number(installmentCount)
                : undefined,
            installmentAmount:
              isLoan && Number(installmentAmount) > 0
                ? Number(installmentAmount)
                : undefined,
            installmentPeriod: installmentPeriod as "monthly" | "weekly",
            hasDueDate,
            dueDate: hasDueDate ? dueDate || undefined : undefined,
            startDate,
            paid: Number(paid),
          };
          loan
            ? update.mutate({ id: loan.id, ...input })
            : create.mutate(input);
        }}
      >
        <div className="form-grid">
          <label>
            Modalidad
            <select value={kind} onChange={e => setKind(e.target.value)}>
              <option value="payable_merch">Mercadería a pagar</option>
              <option value="loan">Préstamo financiero</option>
              <option value="internal">Interno</option>
            </select>
          </label>
          <SuggestedInput
            label="Acreedor / proveedor"
            value={counterparty}
            onChange={setCounterparty}
            options={counterpartyOptions}
            listId="loan-counterparties"
            placeholder="Elegí uno existente o escribí uno nuevo"
          />
        </div>
        <label>
          Detalle
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={
              isLoan ? "Destino del préstamo" : "Mercadería o pedido"
            }
          />
        </label>
        <div className="form-grid">
          <label>
            {isLoan ? "Monto prestado" : "Monto a saldar"}
            <input
              type="number"
              min="0"
              step="0.01"
              value={principal}
              onChange={e => {
                setPrincipal(e.target.value);
                if (!isLoan) setRepayment(e.target.value);
              }}
            />
          </label>
          <label>
            Pagado
            <input
              type="number"
              min="0"
              step="0.01"
              value={paid}
              onChange={e => setPaid(e.target.value)}
            />
          </label>
        </div>
        {(kind === "loan" || kind === "payable_merch") && (
          <>
            <div className="form-grid">
              <label>
                Interés por período
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={interestRate}
                  onChange={e => setInterestRate(e.target.value)}
                  placeholder="40"
                />
              </label>
              <label>
                Unidad
                <select
                  value={interestUnit}
                  onChange={e => setInterestUnit(e.target.value)}
                >
                  <option value="percent">%</option>
                  <option value="usd">USD</option>
                </select>
              </label>
              <label>
                Frecuencia
                <select
                  value={interestPeriod}
                  onChange={e => setInterestPeriod(e.target.value)}
                >
                  <option value="daily">Diario</option>
                  <option value="monthly">Mes</option>
                  <option value="weekly">Semana</option>
                </select>
              </label>
              <label>
                Interés desde (opcional)
                <input
                  type="date"
                  value={interestStartDate}
                  onChange={e => setInterestStartDate(e.target.value)}
                />
                <small className="field-help">
                  Permite iniciar la mora desde una fecha distinta al inicio
                  de la deuda.
                </small>
              </label>
              {interestUnit === "percent" && (
                <label>
                  Base del porcentaje
                  <select
                    value={interestBase}
                    onChange={e => setInterestBase(e.target.value)}
                  >
                    <option value="initial_principal">Base inicial de la deuda</option>
                    <option value="active_balance">Saldo activo actualizado</option>
                  </select>
                  <small className="field-help">
                    Elegí si cada aplicación usa el principal original o el
                    saldo pendiente del momento.
                  </small>
                </label>
              )}
            </div>
            <div className="form-grid">
              <label>
                Monto total a devolver
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={repayment}
                  onChange={e => setRepayment(e.target.value)}
                  placeholder="Si no hay cuotas, es el total final"
                />
              </label>
              <label>
                Cuotas (opcional)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={installmentCount}
                  onChange={e => setInstallmentCount(e.target.value)}
                  placeholder="Sin cuotas"
                />
              </label>
            </div>
            {Number(installmentCount) > 0 && (
              <div className="form-grid">
                <label>
                  Cuota acordada
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={installmentAmount || computedInstallment.toFixed(2)}
                    onChange={e => setInstallmentAmount(e.target.value)}
                  />
                </label>
                <label>
                  Frecuencia de cuotas
                  <select
                    value={installmentPeriod}
                    onChange={e => setInstallmentPeriod(e.target.value)}
                  >
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                  </select>
                </label>
              </div>
            )}
            <div className="data-note">
              <strong>Regla clara</strong>
              <small>
                Con vencimiento y sin una fecha de interés, el monto total a
                devolver queda fijo. Si completás “Interés desde”, el sistema
                calcula la mora desde esa fecha, incluso después del
                vencimiento. Sin vencimiento, cada período completo aumenta el
                monto aplicando interés compuesto.
              </small>
            </div>
          </>
        )}
        {kind !== "internal" && (
          <>
            <label className="check-line">
              <input
                type="checkbox"
                checked={hasDueDate}
                onChange={e => setHasDueDate(e.target.checked)}
              />{" "}
              Tiene vencimiento
            </label>
            {hasDueDate && (
              <label>
                Vencimiento
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <label>
          Inicio
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            {loan ? "Guardar cambios" : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ReceivableForm({
  receivable,
  customerNameOptions,
  onClose,
  onDone,
}: {
  receivable?: any;
  customerNameOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [customerName, setCustomerName] = useState(
    receivable?.customerName || ""
  );
  const [phone, setPhone] = useState(receivable?.phone || "");
  const [description, setDescription] = useState(receivable?.description || "");
  const [principal, setPrincipal] = useState(
    String(receivable?.principal ?? "")
  );
  const [paid, setPaid] = useState(String(receivable?.paid ?? 0));
  const [dueDate, setDueDate] = useState(dateInput(receivable?.dueDate));
  const create = trpc.business.createReceivable.useMutation({
    onSuccess: () => {
      toast.success("Deudor registrado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.business.updateReceivable.useMutation({
    onSuccess: () => {
      toast.success("Deudor actualizado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Modal
      title={receivable ? "Editar deudor" : "Nuevo deudor"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          const input = {
            customerName,
            phone: phone || undefined,
            description: description || undefined,
            principal: Number(principal),
            paid: Number(paid),
            dueDate: dueDate || undefined,
          };
          receivable
            ? update.mutate({ id: receivable.id, ...input })
            : create.mutate(input);
        }}
      >
        <div className="form-grid">
          <SuggestedInput
            label="Cliente"
            value={customerName}
            onChange={setCustomerName}
            options={customerNameOptions}
            listId="receivable-customers"
            placeholder="Elegí un cliente existente o escribí uno nuevo"
            autoFocus
          />
          <label>
            WhatsApp
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </label>
        </div>
        <label>
          Detalle
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Monto
            <input
              type="number"
              min="0"
              step="0.01"
              value={principal}
              onChange={e => setPrincipal(e.target.value)}
            />
          </label>
          <label>
            Pagado
            <input
              type="number"
              min="0"
              step="0.01"
              value={paid}
              onChange={e => setPaid(e.target.value)}
            />
          </label>
        </div>
        <label>
          Vencimiento
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            {receivable ? "Guardar cambios" : "Registrar deudor"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CustomerForm({
  customer,
  localityOptions,
  onClose,
  onDone,
}: {
  customer: any;
  localityOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(customer.name || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [locality, setLocality] = useState(customer.locality || "");
  const [notes, setNotes] = useState(customer.notes || "");
  const update = trpc.business.updateCustomer.useMutation({
    onSuccess: () => {
      toast.success("Cliente actualizado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Modal title="Editar cliente" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          update.mutate({
            id: customer.id,
            name,
            phone: phone || undefined,
            locality: locality || undefined,
            notes: notes || undefined,
          });
        }}
      >
        <label>
          Nombre
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            WhatsApp
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </label>
          <SuggestedInput
            label="Localidad"
            value={locality}
            onChange={setLocality}
            options={localityOptions}
            listId="customer-localities"
          />
        </div>
        <label>
          Notas
          <input value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">Guardar cambios</button>
        </div>
      </form>
    </Modal>
  );
}
function ObjectiveForm({
  objective,
  monthOptions,
  onClose,
  onDone,
}: {
  objective: any;
  monthOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [month, setMonth] = useState(objective.month || "");
  const [targetOrders, setTargetOrders] = useState(
    String(objective.targetOrders ?? 0)
  );
  const [targetRevenue, setTargetRevenue] = useState(
    String(objective.targetRevenue ?? 0)
  );
  const [targetProfit, setTargetProfit] = useState(
    String(objective.targetProfit ?? 0)
  );
  const [targetNet, setTargetNet] = useState(String(objective.targetNet ?? 0));
  const update = trpc.business.updateObjective.useMutation({
    onSuccess: () => {
      toast.success("Objetivo actualizado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Modal title="Editar objetivo" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          update.mutate({
            id: objective.id,
            month,
            targetOrders: Number(targetOrders),
            targetRevenue: Number(targetRevenue),
            targetProfit: Number(targetProfit),
            targetNet: Number(targetNet),
          });
        }}
      >
        <SuggestedInput
          label="Mes"
          value={month}
          onChange={setMonth}
          options={monthOptions}
          listId="objective-months"
        />
        <div className="form-grid">
          <label>
            Pedidos
            <input
              type="number"
              min="0"
              value={targetOrders}
              onChange={e => setTargetOrders(e.target.value)}
            />
          </label>
          <label>
            Facturación
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetRevenue}
              onChange={e => setTargetRevenue(e.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Ganancia bruta
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetProfit}
              onChange={e => setTargetProfit(e.target.value)}
            />
          </label>
          <label>
            Resultado neto
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetNet}
              onChange={e => setTargetNet(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">Guardar cambios</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Home() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  useEffect(() => {
    const onBeforeInstall = (event: any) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);
  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    } else
      toast.info(
        "En iPhone: abrí Compartir y elegí Añadir a pantalla de inicio. En Android: usá el menú del navegador y elegí Instalar aplicación."
      );
  };
  const [active, setActive] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<{ kind: string; data?: any } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const range = useMemo(() => {
    if (period === "all") return { from: undefined, to: undefined };
    const currentDay = dateKeyInArgentina();
    const end = shiftDateKey(currentDay, 1);
    let start = currentDay;
    if (period === "7d") start = shiftDateKey(currentDay, -6);
    else if (period === "month") start = `${currentDay.slice(0, 8)}01`;
    else if (period === "quarter") start = shiftDateKey(currentDay, -89);
    else if (period === "30d") start = shiftDateKey(currentDay, -29);
    return {
      from: start,
      to: end,
    };
  }, [period]);
  const queryOptions = { staleTime: 120000, refetchOnWindowFocus: false };
  const dash = trpc.business.dashboard.useQuery(range, {
    ...queryOptions,
    refetchOnWindowFocus: true,
  });
  const products = trpc.business.products.useQuery(
    { search: search || undefined, category },
    queryOptions
  );
  const allProducts = trpc.business.products.useQuery(undefined, queryOptions);
  const productPerformance = trpc.business.productPerformance.useQuery(
    undefined,
    queryOptions
  );
  const sales = trpc.business.sales.useQuery(undefined, queryOptions);
  const customers = trpc.business.customers.useQuery(undefined, queryOptions);
  const expenses = trpc.business.expenses.useQuery(undefined, {
    ...queryOptions,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const loans = trpc.business.loans.useQuery(undefined, queryOptions);
  const receivables = trpc.business.receivables.useQuery(
    undefined,
    queryOptions
  );
  const ads = trpc.business.ads.useQuery(undefined, queryOptions);
  const adsSpendHistory = trpc.business.adsSpendHistory.useQuery(undefined, queryOptions);
  const auth = trpc.auth.me.useQuery(undefined, queryOptions);
  const refresh = () => {
    dash.refetch();
    products.refetch();
    allProducts.refetch();
    sales.refetch();
    customers.refetch();
    expenses.refetch();
    loans.refetch();
    receivables.refetch();
    ads.refetch();
    adsSpendHistory.refetch();
    setModal(null);
  };
  const data = dash.data;
  const inventoryRows = allProducts.data ?? [];
  const salesRows = sales.data ?? [];
  const customerRows = customers.data ?? [];
  const expenseRows = expenses.data ?? [];
  const loanRows = loans.data ?? [];
  const categoryOptions = useMemo(
    () => uniqueOptions(inventoryRows.map(p => p.category)),
    [allProducts.data]
  );
  const categories = useMemo(
    () => ["Todas", ...categoryOptions],
    [categoryOptions]
  );
  const customerNameOptions = useMemo(
    () => uniqueOptions(customerRows.map(c => c.name)),
    [customers.data]
  );
  const channelOptions = useMemo(
    () =>
      uniqueOptions([
        "WhatsApp",
        "Instagram",
        "Mercado Libre",
        "Minorista",
        "Otro",
        ...salesRows.map(s => s.channel),
      ]),
    [sales.data]
  );
  const expenseCategoryOptions = useMemo(
    () =>
      uniqueOptions([
        "Operativo",
        "Publicidad",
        "Mentoría",
        "Logística",
        ...expenseRows.map(e => e.category),
      ]),
    [expenses.data]
  );
  const expenseTypeOptions = useMemo(
    () =>
      uniqueOptions([
        "Operativo",
        "Publicitario",
        "Mentoría",
        "Logística",
        ...expenseRows.map(e => e.type),
      ]),
    [expenses.data]
  );
  const counterpartyOptions = useMemo(
    () =>
      uniqueOptions([
        ...loanRows.map(l => l.counterparty),
        ...inventoryRows.map(p => p.supplier),
      ]),
    [loans.data, allProducts.data]
  );
  const localityOptions = useMemo(
    () => uniqueOptions(customerRows.map(c => c.locality)),
    [customers.data]
  );
  const pageTitle = nav.find(n => n.id === active)?.label || "Resumen";
  const overdue = (loans.data ?? []).filter(
    l => debtState(l).className === "danger"
  );
  const overdueReceivables = (receivables.data ?? []).filter(
    r => debtState(r).className === "danger"
  );
  const overdueCount = overdue.length + overdueReceivables.length;
  const outstanding = (loans.data ?? []).reduce(
    (a: number, x: any) => a + Number(x.balance || 0),
    0
  );
  const receivableTotal = (receivables.data ?? []).reduce(
    (a: number, x: any) => a + Number(x.balance || 0),
    0
  );
  const open = (kind: string, item?: any) => setModal({ kind, data: item });
  return (
    <div className="app-shell">
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">·</div>
          <div>
            <strong>THE POINT</strong>
            <span>control de negocio</span>
          </div>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="today-note">
          <span className="pulse" />
          Hoy{" "}
          <small>
            {new Date().toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "long",
            })}
          </small>
        </div>
        <nav>
          {nav.map(item => (
            <button
              key={item.id}
              className={active === item.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActive(item.id);
                setMobileOpen(false);
              }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "inventory" && (data?.lowStock?.length ?? 0) > 0 && (
                <em>{data?.lowStock?.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => open("expense")}>
            <FilePlus2 size={18} />
            <span>Nuevo gasto</span>
          </button>
          <div className="user-chip">
            <div className="avatar">{auth.data?.name?.slice(0, 1) || "T"}</div>
            <div>
              <strong>{auth.data?.name || "Socio The Point"}</strong>
              <small>{auth.data ? "Sesión activa" : "Preview"}</small>
            </div>
            <Settings2 size={16} />
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div>
            <span className="eyebrow">THE POINT COMPANY</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="top-actions">
            <DollarTicker />
            <button
              className="button secondary install-button"
              onClick={installApp}
            >
              <Download size={15} /> Instalar app
            </button>
            <button
              className="icon-button"
              title="Actualizar"
              onClick={refresh}
            >
              <RefreshCw size={18} />
            </button>
            <button
              className="notification"
              onClick={() => setActive("finance")}
            >
              <Bell size={18} />
              {overdueCount > 0 && <b>{overdueCount}</b>}
            </button>
            <button
              className="button primary desktop-action"
              onClick={() =>
                active === "ads"
                  ? open("expense", { isAdvertising: true })
                  : open(active === "inventory" ? "product" : active === "finance" ? "expense" : "sale")
              }
            >
              <Plus size={17} />
              {active === "inventory"
                ? "Producto"
                : active === "finance"
                  ? "Gasto"
                  : active === "ads"
                    ? "Gasto Ads"
                    : "Cargar venta"}
            </button>
          </div>
        </header>
        <div className="content">
          {active === "dashboard" && (
            <>
              <div className="welcome-row">
                <div>
                  <p className="eyebrow">
                    Lectura rápida · datos vivos del negocio
                  </p>
                  <h2>Qué está pasando hoy</h2>
                  <p className="muted">
                    No confundas facturación con ganancia: mirá caja, stock,
                    clientes y compromisos juntos.
                  </p>
                </div>
                <select
                  className="period-pill period-select"
                  value={period}
                  onChange={e => setPeriod(e.target.value as typeof period)}
                >
                  {periodOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="metrics-grid">
                <MetricCard
                  label="Facturación"
                  value={money(data?.summary?.revenue)}
                  helper="ventas registradas"
                  icon={CircleDollarSign}
                />
                <MetricCard
                  label="Ganancia bruta"
                  value={money(data?.summary?.profit)}
                  helper={`${Number(data?.advanced?.grossMargin || 0).toFixed(1)}% margen`}
                  tone="green"
                  icon={ArrowUpRight}
                  featured
                />
                <MetricCard
                  label="Inventario"
                  value={money(data?.inventory?.value)}
                  helper={`${number(data?.inventory?.units)} unidades en stock`}
                  tone="sand"
                  icon={Package}
                />
                <MetricCard
                  label="Deuda abierta"
                  value={money(outstanding)}
                  helper={`${loans.data?.length ?? 0} compromisos`}
                  tone="red"
                  icon={CreditCard}
                />
              </div>
              <div className="mini-kpis">
                <div>
                  <span>Pedidos</span>
                  <strong>{number(data?.summary?.orders)}</strong>
                </div>
                <div>
                  <span>Ticket promedio</span>
                  <strong>
                    {money(
                      Number(data?.summary?.orders || 0)
                        ? Number(data?.summary?.revenue || 0) /
                            Number(data?.summary?.orders || 1)
                        : 0
                    )}
                  </strong>
                </div>
                <div>
                  <span>Gastos</span>
                  <strong>{money(data?.expenses?.total)}</strong>
                </div>
                <div>
                  <span>Publicidad</span>
                  <strong>{money(data?.ads?.total)}</strong>
                </div>
                <div>
                  <span>Cobrar a clientes</span>
                  <strong>{money(receivableTotal)}</strong>
                </div>
              </div>
              <div className="advanced-grid">
                <MetricCard
                  label="Ganancia neta"
                  value={money(
                    data?.advanced?.netProfit ?? data?.advanced?.netEstimated
                  )}
                  helper="ganancia bruta − Ads − gastos"
                  tone={
                    Number(
                      data?.advanced?.netProfit ??
                        data?.advanced?.netEstimated ??
                        0
                    ) >= 0
                      ? "green"
                      : "red"
                  }
                  icon={Gauge}
                  featured
                />
                <MetricCard
                  label="Costo mercadería"
                  value={money(data?.advanced?.cogs)}
                  helper="costo de ventas con dato conocido"
                  tone="sand"
                  icon={Boxes}
                />
                <MetricCard
                  label="Tasa de recompra"
                  value={`${Number(data?.advanced?.repeatRate || 0).toFixed(1)}%`}
                  helper={`${number(data?.advanced?.repeatCustomers)} clientes repitieron`}
                  icon={Users}
                />
                <MetricCard
                  label="Rotación estimada"
                  value={`${Number(data?.advanced?.sellThrough || 0).toFixed(1)}%`}
                  helper={
                    data?.advanced?.stockCoverageDays
                      ? `${Number(data.advanced.stockCoverageDays).toFixed(0)} días de cobertura`
                      : "Sin ventas suficientes"
                  }
                  icon={LineChartIcon}
                />
              </div>
              <div className="main-grid">
                <section className="panel action-panel">
                  <SectionHeader
                    eyebrow="para mirar hoy"
                    title="Alertas y oportunidades"
                  />
                  {data?.lowStock?.slice(0, 4).map((p: any) => (
                    <div className="action-row" key={p.id}>
                      <span className="action-icon orange">
                        <Package size={16} />
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>
                          Quedan {p.stock} · mínimo {p.minStock}
                        </small>
                      </div>
                      <span className="status-tag warn">Reponer</span>
                    </div>
                  ))}
                  {overdue.slice(0, 3).map((l: any) => (
                    <div className="action-row" key={`l-${l.id}`}>
                      <span className="action-icon red">
                        <CreditCard size={16} />
                      </span>
                      <div>
                        <strong>{l.counterparty}</strong>
                        <small>
                          Vencía {dateLabel(l.dueDate)} · saldo{" "}
                          {money(l.balance, l.currency)}
                        </small>
                      </div>
                      <span className="status-tag danger">Vencido</span>
                    </div>
                  ))}
                  {overdueReceivables.slice(0, 3).map((r: any) => (
                    <div className="action-row" key={`r-${r.id}`}>
                      <span className="action-icon red">
                        <CreditCard size={16} />
                      </span>
                      <div>
                        <strong>{r.customerName}</strong>
                        <small>
                          Vencía {dateLabel(r.dueDate)} · saldo{" "}
                          {money(r.balance)}
                        </small>
                      </div>
                      <span className="status-tag danger">Vencido</span>
                    </div>
                  ))}
                  {!data?.lowStock?.length &&
                    !overdue.length &&
                    !overdueReceivables.length && (
                      <div className="empty-state">
                        <Sparkles size={19} />
                        <p>Todo tranquilo por ahora.</p>
                      </div>
                    )}
                </section>
              </div>
              <div className="three-grid">
                <section className="panel">
                  <SectionHeader
                    eyebrow="clientes"
                    title="Quién más aporta"
                    action="Ver clientes"
                    onAction={() => setActive("customers")}
                  />
                  <div className="client-list">
                    {(data?.topCustomers ?? [])
                      .slice(0, 5)
                      .map((c: any, i: number) => (
                        <div className="client-row" key={c.id}>
                          <span className="rank">0{i + 1}</span>
                          <div className="avatar small">
                            {c.name?.slice(0, 1)}
                          </div>
                          <div className="client-main">
                            <strong>{c.name}</strong>
                            <small>
                              {c.purchases} compras · última{" "}
                              {dateLabel(c.lastPurchase)}
                            </small>
                          </div>
                          <b>{money(c.spent)}</b>
                        </div>
                      ))}
                  </div>
                </section>
                <section className="panel focus-panel">
                  <span className="eyebrow">acción prioritaria</span>
                  <h3>Ventas que se convierten en caja</h3>
                  <p>Registrá la venta completa, descontá el stock y mirá la ganancia real.</p>
                  <button className="button dark" onClick={() => open("sale")}>
                    <Plus size={16} /> Cargar una venta
                  </button>
                </section>
              </div>
              <ChartsView data={data} period={period} embedded />
            </>
          )}
          {active === "sales" && (
            <SalesView
              sales={sales.data ?? []}
              customers={customers.data ?? []}
              onAdd={() => open("sale")}
              onEdit={item => open("saleEdit", item)}
              onDone={refresh}
            />
          )}
          {active === "inventory" && (
            <InventoryView
              products={products.data ?? []}
              performance={productPerformance.data ?? []}
              categories={categories}
              search={search}
              setSearch={setSearch}
              category={category}
              setCategory={setCategory}
              onAdd={() => open("product")}
              onEdit={item => open("product", item)}
              onDone={refresh}
            />
          )}
          {active === "customers" && (
            <CustomersView
              customers={customers.data ?? []}
              onEdit={item => open("customer", item)}
              onDone={refresh}
            />
          )}
          {active === "finance" && (
            <FinanceView
              expenses={expenses.data ?? []}
              loans={loans.data ?? []}
              receivables={receivables.data ?? []}
              onAddExpense={() => open("expense")}
              onAddLoan={() => open("loan")}
              onAddReceivable={() => open("receivable")}
              onEdit={open}
              onDone={refresh}
            />
          )}
          {active === "ads" && (
            <AdsView
              adsSpendHistory={adsSpendHistory.data}
              ads={ads.data ?? []}
              expenses={expenseRows}
              period={period}
              setPeriod={setPeriod}
              onAdd={() => open("expense", { isAdvertising: true })}
              onEdit={item => open("expense", item)}
              onDone={refresh}
            />
          )}
          {active === "projections" && <ProjectionsView />}
        </div>
      </main>
      {modal?.kind === "sale" && (
        <SaleForm
          products={inventoryRows}
          customers={customerRows}
          customerNameOptions={customerNameOptions}
          channelOptions={channelOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "saleEdit" && (
        <SaleEditForm
          sale={modal.data}
          products={inventoryRows}
          customers={customerRows}
          customerNameOptions={customerNameOptions}
          channelOptions={channelOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "product" && (
        <ProductForm
          product={modal.data}
          categoryOptions={categoryOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "expense" && (
        <ExpenseForm
          expense={modal.data}
          categoryOptions={expenseCategoryOptions}
          typeOptions={expenseTypeOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "loan" && (
        <LoanForm
          loan={modal.data}
          counterpartyOptions={counterpartyOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "receivable" && (
        <ReceivableForm
          receivable={modal.data}
          customerNameOptions={customerNameOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "customer" && (
        <CustomerForm
          customer={modal.data}
          localityOptions={localityOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function ChartsView({ data, period, embedded = false }: { data: any; period: string; embedded?: boolean }) {
  const rawDaily = (data?.daily ?? []).map((row: any) => ({
    ...row,
    label: dateLabel(row.day),
    revenue: Number(row.revenue || 0),
    profit: Number(row.profit || 0),
  }));
  const daily = (period === "quarter" || period === "all"
    ? Object.values(rawDaily.reduce((groups: Record<string, any>, row: any) => {
        const key = String(row.day || "").slice(0, 7);
        const current = groups[key] || { day: `${key}-01`, label: key, revenue: 0, profit: 0 };
        current.revenue += row.revenue;
        current.profit += row.profit;
        groups[key] = current;
        return groups;
      }, {}))
    : rawDaily
  ).slice(period === "quarter" || period === "all" ? -12 : -31);
  const channels = (data?.advanced?.channels ?? []).map((row: any) => ({
    ...row,
    revenue: Number(row.revenue || 0),
    orders: Number(row.orders || 0),
  }));
  const products = (data?.topProducts ?? []).map((row: any) => ({
    ...row,
    shortName: String(row.name || "Producto").slice(0, 18),
    units: Number(row.units || 0),
  }));
  const formatTooltip = (value: any) => money(value);
  return (
    <>
      {!embedded && <div className="view-intro">
        <div>
          <span className="eyebrow">lectura cuantitativa · datos reales</span>
          <h2>Gráficos del negocio</h2>
          <p className="muted">
            Facturación, ganancia, rotación y canales para detectar dónde crecer
            y qué corregir.
          </p>
        </div>
        <span className="period-pill">
          Período: {periodLabel(period)}
        </span>
      </div>}
      {!embedded && <div className="advanced-grid chart-kpis">
        <MetricCard
          label="Facturación"
          value={money(data?.summary?.revenue)}
          helper="ventas del período"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Ganancia bruta"
          value={money(data?.summary?.profit)}
          helper={`${Number(data?.advanced?.grossMargin || 0).toFixed(1)}% margen`}
          tone="green"
          icon={TrendingUp}
          featured
        />
        <MetricCard
          label="Ganancia neta"
          value={money(data?.advanced?.netProfit)}
          helper="bruta − Ads − gastos"
          tone={Number(data?.advanced?.netProfit || 0) >= 0 ? "green" : "red"}
          icon={Gauge}
          featured
        />
        <MetricCard
          label="Unidades vendidas"
          value={number(data?.summary?.units)}
          helper="cantidad registrada"
          tone="sand"
          icon={Package}
        />
      </div>}
      {embedded && <div className="section-header compact-header"><div><span className="eyebrow">lectura cuantitativa · período seleccionado</span><h3>Gráficos del negocio</h3></div><span className="period-pill">{periodLabel(period)}</span></div>}
      <div className="main-grid charts-layout">
        <section className="panel chart-panel">
          <SectionHeader
            eyebrow="ritmo de ventas"
            title={period === "quarter" || period === "all" ? "Facturación y ganancia por mes" : "Facturación y ganancia por día"}
          />
          <div className="chart-legend">
            <span>
              <i className="legend-dot revenue" />
              Facturación
            </span>
            <span>
              <i className="legend-dot profit" />
              Ganancia
            </span>
          </div>
          <div className="chart-wrap">
            {daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={daily}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={formatTooltip} />
                  <Legend wrapperStyle={{ display: "none" }} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Facturación"
                    stroke="#4fd1c5"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Ganancia"
                    stroke="#9bc27d"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">No hay ventas en este período.</div>
            )}
          </div>
        </section>
      </div>
      <div className="main-grid charts-layout">
        <section className="panel chart-panel">
          <SectionHeader eyebrow="rotación" title="Unidades por producto" />
          <div className="chart-wrap">
            {products.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={products}
                  layout="vertical"
                  margin={{ top: 8, right: 8, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={90}
                    tick={{ fontSize: 9 }}
                  />
                  <Tooltip
                    formatter={(value: any) => `${number(value)} unidades`}
                  />
                  <Bar
                    dataKey="units"
                    name="Unidades"
                    fill="#d9ae70"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                Todavía no hay productos vinculados.
              </div>
            )}
          </div>
        </section>
        <section className="panel insight-panel">
          <SectionHeader
            eyebrow="lecturas complementarias"
            title="Qué mirar ahora"
          />
          <div className="insight-list">
            <div>
              <span>Mejor día</span>
              <strong>
                {data?.advanced?.bestDay
                  ? `${dateLabel(data.advanced.bestDay.day)} · ${money(data.advanced.bestDay.revenue)}`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Recompra</span>
              <strong>
                {Number(data?.advanced?.repeatRate || 0).toFixed(1)}%
              </strong>
            </div>
            <div>
              <span>Cobertura de stock</span>
              <strong>
                {data?.advanced?.stockCoverageDays
                  ? `${Number(data.advanced.stockCoverageDays).toFixed(0)} días`
                  : "Sin base suficiente"}
              </strong>
            </div>
          </div>
          <p className="muted chart-note">
            Usá estas señales para decidir qué productos reponer y dónde ajustar
            el seguimiento comercial.
          </p>
        </section>
      </div>
    </>
  );
}
function ProjectionsView() {
  const [growth, setGrowth] = useState(15);
  const projections = trpc.business.projections.useQuery(
    { growthPercent: growth },
    { staleTime: 120000, refetchOnWindowFocus: true }
  );
  const p = projections.data;
  const card = (label: string, value: string, helper: string, tone = "") => (
    <div className={`projection-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">modelo de ritmo · no promesa</span>
          <h2>Proyecciones</h2>
          <p className="muted">
            Una estimación matemática para planificar el próximo mes, separada
            de los datos reales.
          </p>
        </div>
        <label className="growth-control">
          <span>Crecimiento esperado</span>
          <select
            value={growth}
            onChange={e => setGrowth(Number(e.target.value))}
          >
            <option value={0}>0% · conservador</option>
            <option value={10}>10% · base</option>
            <option value={15}>15% · objetivo</option>
            <option value={25}>25% · exigente</option>
            <option value={40}>40% · acelerado</option>
          </select>
        </label>
      </div>
      {!p ? (
        <div className="panel empty-state">
          <TrendingUp size={21} />
          <p>Calculando el modelo con los últimos 30 días...</p>
        </div>
      ) : (
        <>
          <div className="projection-banner">
            <div>
              <span className="eyebrow">mes siguiente</span>
              <h3>{p.targetMonth}</h3>
              <p>
                Base: {p.current.orders} pedidos reales en 30 días ·{" "}
                {p.current.incompleteCosts} con costo pendiente.
              </p>
            </div>
            <div className="projection-badge">
              +{Number(p.growthPercent).toFixed(0)}% supuesto
            </div>
          </div>
          <div className="projection-grid">
            {card(
              "Facturación proyectada",
              money(p.projected.revenue),
              `Actual: ${money(p.current.revenue)}`,
              "teal"
            )}
            {card(
              "Ganancia bruta",
              money(p.projected.profit),
              `Margen actual: ${p.current.revenue ? ((p.current.profit / p.current.revenue) * 100).toFixed(1) : "0.0"}%`,
              "green"
            )}
            {card(
              "Resultado neto estimado",
              money(p.projected.net),
              "Ganancia − gastos − publicidad",
              p.projected.net >= 0 ? "green" : "red"
            )}
            {card(
              "Pedidos",
              number(Math.round(p.projected.orders)),
              `Ritmo: ${p.daily.orders.toFixed(1)} por día`
            )}
            {card(
              "Unidades",
              number(Math.round(p.projected.units)),
              `Ritmo: ${p.daily.units.toFixed(1)} por día`
            )}
            {card(
              "Facturación diaria",
              money(p.daily.revenue),
              `${p.targetMonthDays} días proyectados`
            )}
          </div>
          <div className="main-grid projection-lower">
            <section className="panel">
              <SectionHeader
                eyebrow="lectura de base"
                title="Qué está usando el modelo"
              />
              <div className="projection-lines">
                <div>
                  <span>Período observado</span>
                  <b>
                    {dateLabel(p.period.from)} — {dateLabel(p.period.to)}
                  </b>
                </div>
                <div>
                  <span>Días con ventas</span>
                  <b>{p.period.activeDays}</b>
                </div>
                <div>
                  <span>Gastos + publicidad base</span>
                  <b>{money(p.current.expenses + p.current.adSpend)}</b>
                </div>
                <div>
                  <span>USDT sugerido</span>
                  <b>Para cuidar el valor de reposición</b>
                </div>
              </div>
            </section>
            <section className="panel focus-panel projection-note">
              <span className="eyebrow">regla de decisión</span>
              <h3>Proyección, no promesa.</h3>
              <p>
                Usá este número para definir compras, metas y caja. Si cambian
                el margen, el stock o la capacidad de seguimiento, actualizá el
                supuesto y comparalo con el real.
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function SalesView({
  sales,
  customers,
  onAdd,
  onEdit,
  onDone,
}: {
  sales: any[];
  customers: any[];
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDone: () => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(sales.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const visibleSales = sales.slice((page - 1) * pageSize, page * pageSize);
  const remove = trpc.business.deleteSale.useMutation({
    onSuccess: () => {
      toast.success("Venta eliminada y stock reconciliado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">operación comercial</span>
          <h2>Ventas registradas</h2>
          <p className="muted">
            Editá importes, clientes y fechas. Eliminar una venta de inventario
            devuelve las unidades.
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} /> Cargar venta
        </button>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Cliente</th>
                <th>Facturación</th>
                <th>Ganancia</th>
                <th>Margen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map(s => (
                <tr key={s.id}>
                  <td>{dateLabel(s.saleDate)}</td>
                  <td>
                    <strong>{s.notes || "Sin descripción"}</strong>
                  </td>
                  <td>
                    <strong>{s.customerName || "Venta sin cliente"}</strong>
                    <small>{s.customerPhone || "Dato pendiente"}</small>
                  </td>
                  <td>{money(s.total)}</td>
                  <td className="positive">
                    {s.costKnown === false ? (
                      <span className="status-tag warn">Costo pendiente</span>
                    ) : (
                      money(s.profit)
                    )}
                  </td>
                  <td>
                    {s.costKnown === false
                      ? "—"
                      : `${Number(s.margin || 0).toFixed(1)}%`}
                  </td>
                  <td>
                    <RowActions
                      onEdit={() => onEdit(s)}
                      onDelete={() => remove.mutate({ id: s.id })}
                      deleteLabel={`la venta del ${dateLabel(s.saleDate)}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination-bar">
          <span>
            Mostrando {sales.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, sales.length)} de {sales.length} ventas
          </span>
          <div className="pagination-actions">
            <button
              className="button secondary"
              disabled={page <= 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
            >
              Anterior
            </button>
            <strong>
              Página {page} de {pageCount}
            </strong>
            <button
              className="button secondary"
              disabled={page >= pageCount}
              onClick={() => setPage(value => Math.min(pageCount, value + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
function InventoryView({
  products,
  performance,
  categories,
  search,
  setSearch,
  category,
  setCategory,
  onAdd,
  onEdit,
  onDone,
}: {
  products: any[];
  performance: any[];
  categories: string[];
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDone: () => void;
}) {
  const flavors = trpc.business.allProductFlavors.useQuery(undefined, { staleTime: 0 });
  const createFlavor = trpc.business.createProductFlavor.useMutation({ onSuccess: () => { flavors.refetch(); onDone(); toast.success("Sabor agregado"); }, onError: e => toast.error(e.message) });
  const updateFlavor = trpc.business.updateProductFlavor.useMutation({ onSuccess: () => { flavors.refetch(); onDone(); toast.success("Sabor actualizado"); }, onError: e => toast.error(e.message) });
  const archiveFlavor = trpc.business.archiveProductFlavor.useMutation({ onSuccess: () => { flavors.refetch(); onDone(); toast.success("Sabor archivado"); }, onError: e => toast.error(e.message) });
  const remove = trpc.business.deleteProduct.useMutation({
    onSuccess: r => {
      toast.success(
        r.archived
          ? "Producto archivado para conservar historial"
          : "Producto eliminado"
      );
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">mercadería y costos</span>
          <h2>Inventario</h2>
          <p className="muted">
            Editá stock, costos y mínimos. Los productos con ventas se archivan
            en vez de romper el historial.
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} /> Producto
        </button>
      </div>
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto..."
          />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="inventory-grid">
        {products.map(p => (
          <div
            className={`product-card ${p.stock <= p.minStock ? "low" : ""}`}
            key={p.id}
          >
            <div className="product-card-top">
              <span className="category-dot">
                {p.category?.slice(0, 2).toUpperCase()}
              </span>
              <span
                className={
                  p.stock <= p.minStock ? "status-tag warn" : "status-tag ok"
                }
              >
                {p.stock <= p.minStock ? "Bajo" : "OK"}
              </span>
            </div>
            <h3>{p.name}</h3>
            <p>
              {p.category} · costo {money(p.cost)}
            </p>
            <div className="product-meta">
              <strong>
                {number(p.stock)} <small>unid.</small>
              </strong>
              <span>Valor {money(Number(p.stock) * Number(p.cost))}</span>
            </div>
            {(flavorCategory(p.category) || (flavors.data || []).some(f => f.productId === p.id)) && (
              <div className="flavor-stock-panel">
                <div className="flavor-panel-head"><strong>Variantes</strong><button className="text-button" onClick={() => { const name = prompt("Nombre de la variante"); if (!name?.trim()) return; const value = prompt("Stock disponible", "0"); createFlavor.mutate({ productId: p.id, name: name.trim(), stock: Math.max(0, Number(value || 0)) }); }}><Plus size={13} /> Agregar</button></div>
                {(flavors.data || []).filter(f => f.productId === p.id).map(f => (
                  <div className="flavor-row" key={f.id}><span>{f.name}</span><strong>{f.stock}</strong><button className="text-button" onClick={() => { const value = prompt(`Stock para ${f.name}`, String(f.stock)); if (value !== null) updateFlavor.mutate({ id: f.id, name: f.name, stock: Math.max(0, Number(value)), minStock: f.minStock, notes: f.notes || undefined, active: true }); }}><Pencil size={12} /></button><button className="text-button danger-text" onClick={() => { if (confirmDelete(`el sabor ${f.name}`)) archiveFlavor.mutate({ id: f.id }); }}><Trash2 size={12} /></button></div>
                ))}
                {!(flavors.data || []).some(f => f.productId === p.id) && <small className="muted">Sin variantes cargadas; agregalas para vender por modelo, aroma o sabor.</small>}
              </div>
            )}
            <div className="card-actions">
              <button className="text-button" onClick={() => onEdit(p)}>
                <Pencil size={13} /> Editar
              </button>
              <button
                className="text-button danger-text"
                onClick={() => {
                  if (confirmDelete(`el producto ${p.name}`))
                    remove.mutate({ id: p.id });
                }}
              >
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
      <section className="panel table-panel product-performance-panel">
        <SectionHeader
          eyebrow="rentabilidad y rotación"
          title="Rendimiento de productos"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Unidades</th>
                <th>Facturación</th>
                <th>Ganancia</th>
                <th>Margen</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p: any) => (
                <tr key={p.productId}>
                  <td>
                    <strong>{p.name || "Archivado"}</strong>
                    <small>{p.category || "Sin categoría"}</small>
                  </td>
                  <td>{number(p.units)}</td>
                  <td>{money(p.revenue)}</td>
                  <td className="positive">{money(p.profit)}</td>
                  <td>
                    {Number(p.revenue || 0)
                      ? `${((Number(p.profit || 0) / Number(p.revenue)) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>{number(p.stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!performance.length && (
          <div className="empty-state">
            <Boxes size={20} />
            <p>Registrá ventas de inventario para ver el rendimiento.</p>
          </div>
        )}
      </section>
    </>
  );
}
function CustomersView({
  customers,
  onEdit,
  onDone,
}: {
  customers: any[];
  onEdit: (item: any) => void;
  onDone: () => void;
}) {
  const remove = trpc.business.deleteCustomer.useMutation({
    onSuccess: () => {
      toast.success(
        "Cliente eliminado; sus ventas históricas quedaron conservadas"
      );
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">relación y recompra</span>
          <h2>Clientes</h2>
          <p className="muted">
            Priorizá a quién escribir hoy y volvé a activar clientes con
            contexto.
          </p>
        </div>
        <div className="summary-pill">
          <Users size={16} /> {customers.length} registrados
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Compras</th>
                <th>Total gastado</th>
                <th>Ganancia</th>
                <th>Última compra</th>
                <th>Seguimiento</th>
                <th>Acción</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const days = c.lastPurchase
                  ? Math.max(
                      0,
                      Math.floor(
                        (Date.now() -
                          new Date(
                            `${dateInput(c.lastPurchase)}T12:00:00`
                          ).getTime()) /
                          86400000
                      )
                    )
                  : 999;
                const wa = whatsappUrl(c.phone, c.name);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small>{c.phone || "Sin teléfono"}</small>
                    </td>
                    <td>{c.purchases}</td>
                    <td>{money(c.spent)}</td>
                    <td className="positive">{money(c.profit)}</td>
                    <td>{dateLabel(c.lastPurchase)}</td>
                    <td>
                      <span
                        className={`status-tag ${days > 14 ? "warn" : "ok"}`}
                      >
                        {days > 14 ? `${days} días sin volver` : "Activo"}
                      </span>
                    </td>
                    <td>
                      {wa ? (
                        <a
                          className="whatsapp-button"
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={14} /> Escribir
                        </a>
                      ) : (
                        <span className="soft-tag">Sin WhatsApp</span>
                      )}
                    </td>
                    <td>
                      <RowActions
                        onEdit={() => onEdit(c)}
                        onDelete={() => remove.mutate({ id: c.id })}
                        deleteLabel={`al cliente ${c.name}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
function FinanceView({
  expenses,
  loans,
  receivables,
  onAddExpense,
  onAddLoan,
  onAddReceivable,
  onEdit,
  onDone,
}: {
  expenses: any[];
  loans: any[];
  receivables: any[];
  onAddExpense: () => void;
  onAddLoan: () => void;
  onAddReceivable: () => void;
  onEdit: (kind: string, item?: any) => void;
  onDone: () => void;
}) {
  const activeLoans = loans.filter(l => Number(l.balance || 0) > 0);
  const settledLoans = loans.filter(l => Number(l.balance || 0) <= 0 || l.status === "paid");
  const outstanding = activeLoans.reduce((a, l) => a + Number(l.balance || 0), 0);
  const receivableTotal = receivables.reduce(
    (a, r) => a + Number(r.balance || 0),
    0
  );
  const normalExpenses = expenses.filter((expense: any) => {
    const category = String(expense.category || "").toLocaleLowerCase("es-AR");
    if (category.includes("publicista")) return true;
    const searchable = `${category} ${expense.type || ""} ${expense.platform || ""} ${expense.campaign || ""}`.toLocaleLowerCase("es-AR");
    return !["publicidad", "publicitario", "meta ads", "rdads"].some(term =>
      searchable.includes(term)
    );
  });
  const spent = normalExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const pay = trpc.business.payLoan.useMutation({
    onSuccess: result => {
      toast.success(
        result.interestExpense > 0
          ? `Pago registrado · ${money(result.interestExpense)} cargados como gasto de intereses`
          : "Pago registrado"
      );
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const applyInterest = trpc.business.applyLoanInterest.useMutation({
    onSuccess: result => {
      toast.success(`Interés aplicado: ${money(result.interest)}`);
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const payReceivable = trpc.business.payReceivable.useMutation({
    onSuccess: () => {
      toast.success("Cobro registrado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const removeLoan = trpc.business.deleteLoan.useMutation({
    onSuccess: () => {
      toast.success("Compromiso eliminado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const removeReceivable = trpc.business.deleteReceivable.useMutation({
    onSuccess: () => {
      toast.success("Deudor eliminado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const removeExpense = trpc.business.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success("Gasto eliminado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const requestPayment = (item: any, kind: "loan" | "receivable") => {
    const value = window.prompt(
      kind === "loan"
        ? `¿Cuánto pagaste a ${item.counterparty}?`
        : `¿Cuánto cobraste a ${item.customerName}?`,
      "0"
    );
    const amount = Number(value);
    if (amount > 0)
      (kind === "loan" ? pay : payReceivable).mutate({ id: item.id, amount });
  };
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">caja y compromisos</span>
          <h2>Finanzas</h2>
          <p className="muted">
            Editá cualquier registro y usá los pagos parciales para mantener el
            saldo real.
          </p>
        </div>
        <div className="view-actions">
          <button className="button secondary" onClick={onAddReceivable}>
            <Plus size={15} /> Deudor
          </button>
          <button className="button primary" onClick={onAddExpense}>
            <Plus size={15} /> Gasto
          </button>
        </div>
      </div>
      <div className="finance-cards">
        <div className="finance-stat">
          <span>Por pagar</span>
          <strong>{money(outstanding)}</strong>
          <small>{activeLoans.length} compromisos abiertos</small>
        </div>
        <div className="finance-stat danger-stat">
          <span>Por cobrar</span>
          <strong>{money(receivableTotal)}</strong>
          <small>{receivables.length} cuentas activas</small>
        </div>
        <div className="finance-stat">
          <span>Gastos cargados</span>
          <strong>{money(spent)}</strong>
          <small>Meta Ads se muestra aparte y se descuenta del neto.</small>
        </div>
      </div>
      <div className="finance-grid">
        <section className="panel table-panel">
          <SectionHeader
            eyebrow="salidas"
            title="Gastos"
            action="Nuevo gasto"
            onAction={onAddExpense}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {normalExpenses.map(e => (
                  <tr key={e.id}>
                    <td>{dateLabel(e.expenseDate)}</td>
                    <td>
                      <strong>{e.category === "Publicidad" || e.type === "Publicitario" || e.type === "Meta Ads" ? "Publicidad" : e.description}</strong>
                      {!(e.category === "Publicidad" || e.type === "Publicitario" || e.type === "Meta Ads") && <small>{e.category}</small>}
                    </td>
                    <td>
                      <span className="soft-tag">{e.type}</span>
                    </td>
                    <td>{money(e.amount)}</td>
                    <td>
                      <RowActions
                        onEdit={() => onEdit("expense", e)}
                        onDelete={() => removeExpense.mutate({ id: e.id })}
                        deleteLabel={`el gasto ${e.description}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel table-panel">
          <SectionHeader
            eyebrow="mercadería a pagar"
            title="Compromisos"
            action="Nuevo"
            onAction={onAddLoan}
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Acreedor</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.counterparty}</strong>
                      <small>
                        {l.description || l.notes || l.kind}
                        {(l.kind === "loan" || l.kind === "payable_merch") && Number(l.interestRate || 0) > 0 &&
                          ` · ${l.interestUnit === "usd" ? "USD" : "%"} ${Number(l.interestRate || 0).toFixed(2)} ${l.interestPeriod === "weekly" ? "semanal" : l.interestPeriod === "daily" ? "diario" : "mensual"}${l.interestUnit === "percent" ? ` · ${l.interestBase === "active_balance" ? "saldo activo" : "base inicial"}` : ""}${l.interestStartDate ? ` desde ${dateLabel(l.interestStartDate)}` : ""}`}
                      </small>
                    </td>
                    <td>{dateLabel(l.dueDate)}</td>
                    <td>
                      <DebtStatusTag item={l} />
                    </td>
                    <td>
                      {money(l.balance, l.currency)}
                      {Number(l.balance) > 0 && (
                        <button
                          className="text-button pay-button"
                          onClick={() => requestPayment(l, "loan")}
                        >
                          Pagar
                        </button>
                      )}
                      {Number(l.interestRate || 0) > 0 && Number(l.balance || 0) > 0 && (
                        <button
                          className="text-button pay-button"
                          onClick={() => applyInterest.mutate({ id: l.id })}
                        >
                          Aplicar interés
                        </button>
                      )}
                    </td>
                    <td>
                      <RowActions
                        onEdit={() => onEdit("loan", l)}
                        onDelete={() => removeLoan.mutate({ id: l.id })}
                        deleteLabel={`el compromiso con ${l.counterparty}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel table-panel">
        <SectionHeader eyebrow="historial financiero" title="Compromisos saldados" />
        <p className="muted">Registro separado de obligaciones canceladas, con descripción, monto inicial, fecha de inicio y vencimiento pactado. La fecha de pago no se infiere a partir de la última edición.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Acreedor</th><th>Descripción</th><th>Monto inicial</th><th>Inicio</th><th>Vencimiento pactado</th><th>Estado</th></tr></thead>
            <tbody>
              {settledLoans.length ? settledLoans.map(l => (
                <tr key={`settled-${l.id}`}>
                  <td><strong>{l.counterparty}</strong></td>
                  <td>{l.description || l.notes || l.kind}</td>
                  <td>{money(l.principal, l.currency)}</td>
                  <td>{dateLabel(l.startDate)}</td>
                  <td>{dateLabel(l.dueDate)}</td>
                  <td><span className="status-tag ok">Saldado</span><small>{money(l.paid, l.currency)} cancelados</small></td>
                </tr>
              )) : <tr><td colSpan={6} className="empty-cell">Todavía no hay compromisos saldados registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel table-panel receivables-panel">
        <SectionHeader
          eyebrow="cobros pendientes"
          title="Deudores"
          action="Nuevo deudor"
          onAction={onAddReceivable}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {receivables.map(r => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.customerName}</strong>
                    <small>{r.description || r.phone || "Sin detalle"}</small>
                  </td>
                  <td>{dateLabel(r.dueDate)}</td>
                  <td>
                    <DebtStatusTag item={r} />
                  </td>
                  <td>
                    {money(r.balance)}
                    {Number(r.balance) > 0 && (
                      <button
                        className="text-button pay-button"
                        onClick={() => requestPayment(r, "receivable")}
                      >
                        Cobrar
                      </button>
                    )}
                  </td>
                  <td>
                    <RowActions
                      onEdit={() => onEdit("receivable", r)}
                      onDelete={() => removeReceivable.mutate({ id: r.id })}
                      deleteLabel={`la cuenta de ${r.customerName}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function AdsView({
  adsSpendHistory,
  ads,
  expenses,
  period,
  setPeriod,
  onAdd,
  onEdit,
  onDone,
}: {
  adsSpendHistory?: { manual: any[]; daily: any[] };
  ads?: any[];
  expenses?: any[];
  period: PeriodKey;
  setPeriod: (value: PeriodKey) => void;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDone: () => void;
}) {
  const removeExpense = trpc.business.deleteExpense.useMutation({
    onSuccess: onDone,
    onError: error => toast.error(error.message),
  });
  const fallbackByDay = new Map<string, { date: string; spend: number; entries: number }>();
  const addFallback = (dateValue: unknown, amountValue: unknown) => {
    const date = String(dateValue || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const row = fallbackByDay.get(date) || { date, spend: 0, entries: 0 };
    row.spend += Number(amountValue || 0);
    row.entries += 1;
    fallbackByDay.set(date, row);
  };
  for (const row of ads ?? []) addFallback(row.adDate, row.amount);
  const advertisingExpenses = (expenses ?? []).filter((row: any) => {
    const searchable = `${row.category || ""} ${row.type || ""} ${row.platform || ""} ${row.description || ""} ${row.campaign || ""}`.toLocaleLowerCase("es-AR");
    return !searchable.includes("publicista") && (
      searchable.includes("publicidad") || searchable.includes("publicitario") || searchable.includes("meta ads")
    );
  });
  for (const row of advertisingExpenses) {
    if (row.category === "Publicidad" || row.type === "Publicitario" || row.type === "Meta Ads")
      addFallback(row.expenseDate, row.amount);
  }
  const sourceDaily = adsSpendHistory?.daily?.length
    ? adsSpendHistory.daily
    : [...fallbackByDay.values()];
  const allDaily = sourceDaily
    .map((row: any) => ({
      date: String(row.date || "").slice(0, 10),
      spend: Number(row.spend || 0),
      entries: Number(row.entries || 0),
    }))
    .filter((row: any) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
  const currentDay = dateKeyInArgentina();
  const currentMonth = currentDay.slice(0, 7);
  let from = currentDay;
  if (period === "7d") from = shiftDateKey(currentDay, -6);
  else if (period === "30d") from = shiftDateKey(currentDay, -29);
  else if (period === "month") from = `${currentMonth}-01`;
  else if (period === "quarter") from = shiftDateKey(currentDay, -89);
  else if (period === "all") from = allDaily[0]?.date || currentDay;
  const selectedDaily = allDaily.filter(row => row.date >= from && row.date <= currentDay);
  const selectedTotal = selectedDaily.reduce((sum, row) => sum + row.spend, 0);
  const total = allDaily.reduce((sum, row) => sum + row.spend, 0);
  const monthTotal = allDaily
    .filter(row => row.date.startsWith(currentMonth))
    .reduce((sum, row) => sum + row.spend, 0);
  const spendByDay = new Map(selectedDaily.map(row => [row.date, row]));
  let chartRows: { date: string; label: string; spend: number }[] = [];
  if (period === "quarter") {
    const byWeek = new Map<string, number>();
    for (const row of selectedDaily) {
      const day = new Date(`${row.date}T12:00:00Z`).getUTCDay();
      const weekStart = shiftDateKey(row.date, -((day + 6) % 7));
      byWeek.set(weekStart, (byWeek.get(weekStart) || 0) + row.spend);
    }
    const firstDay = new Date(`${from}T12:00:00Z`).getUTCDay();
    let cursor = shiftDateKey(from, -((firstDay + 6) % 7));
    while (cursor <= currentDay) {
      chartRows.push({ date: cursor, label: `Sem. ${dateLabel(cursor)}`, spend: byWeek.get(cursor) || 0 });
      cursor = shiftDateKey(cursor, 7);
    }
  } else if (period === "all") {
    const byMonth = new Map<string, number>();
    for (const row of allDaily) {
      const month = row.date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + row.spend);
    }
    chartRows = [...byMonth.entries()].slice(-12).map(([month, spend]) => ({
      date: `${month}-01`,
      label: new Date(`${month}-01T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
      spend,
    }));
  } else {
    for (let cursor = from; cursor <= currentDay; cursor = shiftDateKey(cursor, 1)) {
      chartRows.push({
        date: cursor,
        label: dateLabel(cursor),
        spend: spendByDay.get(cursor)?.spend || 0,
      });
    }
  }
  const chartNote = period === "quarter"
    ? "Totales por semana para mantener legible el trimestre"
    : period === "all"
      ? "Totales por mes · últimos 12 meses"
      : "Importe por día calendario";
  const detailRows = [...allDaily].reverse();
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">control manual de inversión</span>
          <h2>Publicidad</h2>
          <p className="muted">Cargá cada gasto real y revisá su evolución. Las cargas nuevas quedan en Gastos de Finanzas; no hay sincronización ni panel de campañas.</p>
        </div>
        <div className="view-actions">
          <select className="period-pill period-select" value={period} onChange={e => setPeriod(e.target.value as PeriodKey)} aria-label="Período de publicidad">
            {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="button primary" onClick={onAdd}><Plus size={17} /> Cargar gasto</button>
        </div>
      </div>
      <div className="data-note page-note">
        <div>
          <strong>Histórico de inversión conservado</strong>
          <small>Se mantienen los registros ya cargados. La tabla muestra totales diarios; el histórico heredado queda en consulta y las nuevas cargas se consultan o editan desde Finanzas → Gastos.</small>
        </div>
      </div>
      <div className="finance-cards">
        <div className="finance-stat"><span>Ads acumulado</span><strong>{money(total)}</strong><small>Todo el histórico</small></div>
        <div className="finance-stat"><span>Este mes</span><strong>{money(monthTotal)}</strong><small>Mes calendario actual</small></div>
        <div className="finance-stat"><span>Período seleccionado</span><strong>{money(selectedTotal)}</strong><small>{periodLabel(period)}</small></div>
      </div>
      <section className="panel chart-panel">
        <div className="section-header compact-header"><div><span className="eyebrow">ritmo de inversión</span><h3>{period === "quarter" ? "Gasto semanal en Ads" : period === "all" ? "Gasto mensual en Ads" : "Gasto diario en Ads"}</h3></div><small className="muted">{chartNote}</small></div>
        <div className="chart-wrap" style={{ height: 280 }}>
          {chartRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={12} />
                <YAxis width={55} tick={{ fontSize: 11 }} tickFormatter={value => `$${Number(value).toLocaleString("es-AR")}`} />
                <Tooltip formatter={(value: number) => [money(value), "Gasto Ads"]} labelFormatter={label => `${period === "quarter" ? "Semana" : period === "all" ? "Mes" : "Día"}: ${label}`} />
                <Bar dataKey="spend" name="Gasto Ads" fill="#7ed8ce" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-cell">Todavía no hay gastos de Ads manuales cargados.</div>}
        </div>
      </section>
      <section className="panel table-panel">
        <SectionHeader eyebrow="detalle editable" title="Gastos manuales registrados" action="Cargar gasto" onAction={onAdd} />
        <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Detalle</th><th>Tipo</th><th>Monto</th><th></th></tr></thead><tbody>
          {advertisingExpenses.length ? advertisingExpenses.sort((a: any, b: any) => String(b.expenseDate).localeCompare(String(a.expenseDate)) || Number(b.id) - Number(a.id)).map((row: any) => <tr key={row.id}>
            <td>{dateLabel(row.expenseDate)}</td>
            <td><strong>Publicidad</strong><small>{row.platform || row.campaign || "Meta Ads manual"}</small></td>
            <td><span className="soft-tag">Meta Ads</span></td>
            <td>{money(row.amount)}</td>
            <td><RowActions onEdit={() => onEdit(row)} onDelete={() => removeExpense.mutate({ id: row.id })} deleteLabel={`el gasto del ${dateLabel(row.expenseDate)}`} /></td>
          </tr>) : <tr><td colSpan={5} className="empty-cell">Sin gastos de Ads registrados todavía.</td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}
function ObjectivesView({
  objectives,
  onEdit,
  onDone,
}: {
  objectives: any[];
  onEdit: (item: any) => void;
  onDone: () => void;
}) {
  const remove = trpc.business.deleteObjective.useMutation({
    onSuccess: () => {
      toast.success("Objetivo eliminado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">dirección</span>
          <h2>Objetivos</h2>
          <p className="muted">
            Actualizá las metas cuando cambie la estrategia o la capacidad de
            stock.
          </p>
        </div>
      </div>
      <div className="objective-grid">
        {objectives.map(o => (
          <section className="panel objective-card" key={o.id}>
            <div className="objective-head">
              <div>
                <span className="eyebrow">meta mensual</span>
                <h3>{o.month}</h3>
              </div>
              <RowActions
                onEdit={() => onEdit(o)}
                onDelete={() => remove.mutate({ id: o.id })}
                deleteLabel={`el objetivo de ${o.month}`}
              />
            </div>
            <div className="objective-metrics">
              <div>
                <span>Pedidos</span>
                <strong>{number(o.targetOrders)}</strong>
              </div>
              <div>
                <span>Facturación</span>
                <strong>{money(o.targetRevenue)}</strong>
              </div>
              <div>
                <span>Ganancia</span>
                <strong>{money(o.targetProfit)}</strong>
              </div>
              <div>
                <span>Neto</span>
                <strong>{money(o.targetNet)}</strong>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
