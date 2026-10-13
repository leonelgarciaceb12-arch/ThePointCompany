import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart } from "recharts";
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
  LineChart,
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
  Target,
  Trash2,
  Users,
  Wallet,
  X,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

const money = (value: unknown, currency = "USD") =>
  `${currency === "USD" ? "US$" : "$"}${Number(value ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value: unknown) => Number(value ?? 0).toLocaleString("es-AR");
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
const today = new Date().toISOString().slice(0, 10);
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
  { id: "objectives", label: "Objetivos", icon: Target },
  { id: "projections", label: "Proyecciones", icon: TrendingUp },
];

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
    quantity: string;
    description: string;
    unitPrice: string;
    unitCost: string;
  };
  const emptyLine = (): SaleLine => ({
    productId: "",
    quantity: "1",
    description: "",
    unitPrice: "",
    unitCost: "",
  });
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState("WhatsApp");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial">(
    "paid"
  );
  const [paidAmount, setPaidAmount] = useState("");
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
    const unitPrice = Math.max(0, Number(line.unitPrice || 0));
    const unitCost = fromInventory
      ? Number(selected.cost || 0)
      : Number(line.unitCost || 0);
    return { line, selected, fromInventory, quantity, unitPrice, unitCost };
  });
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
      description: product ? product.name : "",
      unitCost: product ? String(product.cost) : "",
    });
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
              item => !item.selected && !item.line.description.trim()
            )
          )
            return toast.error(
              "Completá la descripción de cada mercadería externa"
            );
          if (paymentStatus === "partial" && !customerName.trim())
            return toast.error("Indicá el cliente que queda como deudor");
          createSale.mutate({
            date: today,
            channel,
            customerId: customerId ? Number(customerId) : undefined,
            customerName: customerName || undefined,
            customerPhone: phone || undefined,
            paymentStatus,
            paidAmount: paid,
            items: prepared.map(item => ({
              productId: item.selected?.id,
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
                  Producto del inventario{" "}
                  <span className="muted">
                    (opcional · opciones del inventario)
                  </span>
                  <select
                    value={line.productId}
                    onChange={e => selectProduct(index, e.target.value)}
                  >
                    <option value="">Venta manual / mercadería externa</option>
                    {products.map(p => (
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
                    Precio unitario
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={e =>
                        updateLine(index, { unitPrice: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </label>
                </div>
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
            Cliente existente
            <select
              value={customerId}
              onChange={e => {
                const id = e.target.value;
                setCustomerId(id);
                const c = customers.find(x => String(x.id) === id);
                if (c) {
                  setCustomerName(c.name);
                  setPhone(c.phone || "");
                }
              }}
            >
              <option value="">Sin vincular / nuevo</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.purchases} compras
                </option>
              ))}
            </select>
          </label>
          <SuggestedInput
            label="Nombre / WhatsApp"
            value={customerName}
            onChange={setCustomerName}
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
  customers,
  customerNameOptions,
  channelOptions,
  onClose,
  onDone,
}: {
  sale: any;
  customers: any[];
  customerNameOptions: string[];
  channelOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(dateInput(sale.saleDate));
  const [customerId, setCustomerId] = useState(
    sale.customerId ? String(sale.customerId) : ""
  );
  const [customerName, setCustomerName] = useState(sale.customerName || "");
  const [phone, setPhone] = useState(sale.customerPhone || "");
  const [channel, setChannel] = useState(sale.channel || "WhatsApp");
  const [total, setTotal] = useState(String(sale.total ?? ""));
  const [totalCost, setTotalCost] = useState(
    sale.costKnown === false ? "" : String(sale.totalCost ?? "")
  );
  const [costKnown, setCostKnown] = useState(sale.costKnown !== false);
  const [description, setDescription] = useState("");
  const update = trpc.business.updateSale.useMutation({
    onSuccess: () => {
      toast.success("Venta actualizada");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Modal title="Editar venta" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          update.mutate({
            id: sale.id,
            date,
            customerId: customerId ? Number(customerId) : null,
            customerName: customerName || undefined,
            customerPhone: phone || undefined,
            channel,
            total: Number(total),
            totalCost: Number(totalCost || 0),
            costKnown,
            description: description || undefined,
          });
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
            Canal
            <select value={channel} onChange={e => setChannel(e.target.value)}>
              {channelOptions.map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Facturación
            <input
              type="number"
              min="0"
              step="0.01"
              value={total}
              onChange={e => setTotal(e.target.value)}
            />
          </label>
          <label>
            Costo total
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalCost}
              disabled={!costKnown}
              onChange={e => setTotalCost(e.target.value)}
              placeholder={costKnown ? "0.00" : "Pendiente"}
            />
          </label>
        </div>
        <label className="check-line">
          <input
            type="checkbox"
            checked={costKnown}
            onChange={e => setCostKnown(e.target.checked)}
          />{" "}
          Confirmo que el costo está cargado
        </label>
        <label>
          Detalle
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descripción opcional"
          />
        </label>
        <div className="form-grid">
          <label>
            Cliente
            <select
              value={customerId}
              onChange={e => {
                const id = e.target.value;
                setCustomerId(id);
                const c = customers.find(x => String(x.id) === id);
                if (c) {
                  setCustomerName(c.name);
                  setPhone(c.phone || "");
                }
              }}
            >
              {!customerId && <option value="">Sin vincular</option>}
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <SuggestedInput
            label="Nombre / WhatsApp"
            value={customerName}
            onChange={setCustomerName}
            options={customerNameOptions}
            listId="sale-edit-customer-names"
          />
        </div>
        <label>
          Teléfono
          <input value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={update.isPending}>
            {update.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
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
  const [date, setDate] = useState(dateInput(expense?.expenseDate) || today);
  const [category, setCategory] = useState(expense?.category || "Operativo");
  const [description, setDescription] = useState(expense?.description || "");
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [type, setType] = useState(expense?.type || "Operativo");
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
      title={expense ? "Editar gasto" : "Registrar gasto"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          const input = {
            date,
            category,
            description,
            amount: Number(amount),
            type,
            notes: notes || undefined,
          };
          expense
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
            <select value={type} onChange={e => setType(e.target.value)}>
              {typeOptions.map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
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
        <label>
          Descripción
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="¿En qué se gastó?"
          />
        </label>
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
  const [interestPeriod, setInterestPeriod] = useState(
    loan?.interestPeriod || "monthly"
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
            interestRate: isLoan ? Number(interestRate) : 0,
            interestPeriod: interestPeriod as "monthly" | "weekly",
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
        {isLoan && (
          <>
            <div className="form-grid">
              <label>
                Tasa por período (%)
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
                La tasa aplica cada
                <select
                  value={interestPeriod}
                  onChange={e => setInterestPeriod(e.target.value)}
                >
                  <option value="monthly">Mes</option>
                  <option value="weekly">Semana</option>
                </select>
              </label>
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
                Con vencimiento: el monto total a devolver queda fijo. Sin
                vencimiento: cada período completo aumenta el monto a devolver
                aplicando interés compuesto.
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
function AdForm({
  ad,
  platformOptions,
  campaignOptions,
  onClose,
  onDone,
}: {
  ad?: any;
  platformOptions: string[];
  campaignOptions: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(dateInput(ad?.adDate) || today);
  const [platform, setPlatform] = useState(ad?.platform || "Meta Ads");
  const [campaign, setCampaign] = useState(
    ad?.campaign || "Campaña inicial propia de ventas - Multiples estilos"
  );
  const [amount, setAmount] = useState(String(ad?.amount ?? ""));
  const create = trpc.business.createAd.useMutation({
    onSuccess: () => {
      toast.success("Registro publicitario guardado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.business.updateAd.useMutation({
    onSuccess: () => {
      toast.success("Publicidad actualizada");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Modal
      title={ad ? "Editar publicidad" : "Registrar publicidad"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={e => {
          e.preventDefault();
          const input = { date, platform, campaign, amount: Number(amount) };
          ad ? update.mutate({ id: ad.id, ...input }) : create.mutate(input);
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
          <SuggestedInput
            label="Plataforma"
            value={platform}
            onChange={setPlatform}
            options={platformOptions}
            listId="ad-platforms"
          />
        </div>
        <SuggestedInput
          label="Campaña"
          value={campaign}
          onChange={setCampaign}
          options={campaignOptions}
          listId="ad-campaigns"
        />
        <label>
          Gasto verificado
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>
        <div className="data-note">
          <strong>Conversiones no cargadas manualmente</strong>
          <small>
            Se mostrarán únicamente cuando exista una sincronización real con
            Meta Ads.
          </small>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary">
            {ad ? "Guardar cambios" : "Registrar"}
          </button>
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
  const [period, setPeriod] = useState<
    "today" | "7d" | "30d" | "month" | "quarter" | "all"
  >("30d");
  const range = useMemo(() => {
    if (period === "all") return { from: undefined, to: undefined };
    const end = new Date();
    end.setDate(end.getDate() + 1);
    const start = new Date();
    if (period === "today") start.setDate(start.getDate());
    else if (period === "7d") start.setDate(start.getDate() - 6);
    else if (period === "month") start.setDate(1);
    else if (period === "quarter") start.setDate(start.getDate() - 89);
    else start.setDate(start.getDate() - 29);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
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
  const sales = trpc.business.sales.useQuery({ limit: 150 }, queryOptions);
  const customers = trpc.business.customers.useQuery(undefined, queryOptions);
  const expenses = trpc.business.expenses.useQuery(undefined, queryOptions);
  const loans = trpc.business.loans.useQuery(undefined, queryOptions);
  const receivables = trpc.business.receivables.useQuery(
    undefined,
    queryOptions
  );
  const ads = trpc.business.ads.useQuery(undefined, queryOptions);
  const objectives = trpc.business.objectives.useQuery(undefined, queryOptions);
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
    objectives.refetch();
    setModal(null);
  };
  const data = dash.data;
  const inventoryRows = allProducts.data ?? [];
  const salesRows = sales.data ?? [];
  const customerRows = customers.data ?? [];
  const expenseRows = expenses.data ?? [];
  const loanRows = loans.data ?? [];
  const adRows = ads.data ?? [];
  const objectiveRows = objectives.data ?? [];
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
        "Publicidad",
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
  const platformOptions = useMemo(
    () => uniqueOptions(["Meta Ads", ...adRows.map(a => a.platform)]),
    [ads.data]
  );
  const campaignOptions = useMemo(
    () =>
      uniqueOptions([
        "Campaña inicial propia de ventas - Multiples estilos",
        ...adRows.map(a => a.campaign),
      ]),
    [ads.data]
  );
  const monthOptions = useMemo(
    () => uniqueOptions(objectiveRows.map(o => o.month)),
    [objectives.data]
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
  const currentObjective =
    objectives.data?.find(o => o.month === "Octubre") || objectives.data?.[0];
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
            {!auth.data && (
              <button
                className="button secondary login"
                onClick={() => startLogin()}
              >
                Ingresar
              </button>
            )}
            <button
              className="button primary desktop-action"
              onClick={() =>
                open(
                  active === "inventory"
                    ? "product"
                    : active === "finance"
                      ? "expense"
                      : active === "ads"
                        ? "ad"
                        : "sale"
                )
              }
            >
              <Plus size={17} />
              {active === "inventory"
                ? "Producto"
                : active === "finance"
                  ? "Gasto"
                  : active === "ads"
                    ? "Publicidad"
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
                  <option value="today">Día corriente</option>
                  <option value="7d">Últimos 7 días</option>
                  <option value="30d">Últimos 30 días</option>
                  <option value="month">Este mes</option>
                  <option value="quarter">Último trimestre · 90 días</option>
                  <option value="all">Todo el historial</option>
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
                  <span>Meta Ads</span>
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
                  icon={LineChart}
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
                    eyebrow="rentabilidad"
                    title="Canales que aportan"
                    action="Publicidad"
                    onAction={() => setActive("ads")}
                  />
                  <div className="mini-bars">
                    {(data?.advanced?.channels ?? [])
                      .slice(0, 5)
                      .map((p: any, i: number) => (
                        <div className="bar-row" key={`${p.channel}-${i}`}>
                          <div>
                            <span>{p.channel || "Sin canal"}</span>
                            <small>{number(p.orders)} pedidos</small>
                          </div>
                          <div className="bar-track">
                            <span
                              style={{
                                width: `${Math.min(100, Math.max(8, (Number(p.revenue || 0) / Math.max(1, Number(data?.summary?.revenue || 1))) * 100))}%`,
                              }}
                            />
                          </div>
                          <b>{money(p.revenue)}</b>
                        </div>
                      ))}
                  </div>
                </section>
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
                  <span className="eyebrow">objetivo visible</span>
                  <h3>
                    {currentObjective
                      ? `Objetivo ${currentObjective.month}`
                      : "Ventas que se convierten en caja"}
                  </h3>
                  <p>
                    {currentObjective
                      ? `Meta: ${money(currentObjective.targetRevenue)} de facturación y ${number(currentObjective.targetOrders)} pedidos. La ganancia neta actual es ${money(data?.advanced?.netProfit ?? data?.advanced?.netEstimated)}.`
                      : "Registrar la venta completa, descontar el stock y mirar la ganancia real."}
                  </p>
                  <button className="button dark" onClick={() => open("sale")}>
                    <Plus size={16} /> Cargar una venta
                  </button>
                </section>
              </div>
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
              cashFlow={data?.cashFlow}
              onAddExpense={() => open("expense")}
              onAddLoan={() => open("loan")}
              onAddReceivable={() => open("receivable")}
              onEdit={open}
              onDone={refresh}
            />
          )}
          {active === "ads" && (
            <AdsView
              ads={ads.data ?? []}
              onAdd={() => open("ad")}
              onEdit={item => open("ad", item)}
              onDone={refresh}
            />
          )}
          {active === "objectives" && (
            <ObjectivesView
              objectives={objectives.data ?? []}
              onEdit={item => open("objective", item)}
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
      {modal?.kind === "ad" && (
        <AdForm
          ad={modal.data}
          platformOptions={platformOptions}
          campaignOptions={campaignOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
      {modal?.kind === "objective" && (
        <ObjectiveForm
          objective={modal.data}
          monthOptions={monthOptions}
          onClose={() => setModal(null)}
          onDone={refresh}
        />
      )}
    </div>
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
                <th>Cliente</th>
                <th>Canal</th>
                <th>Facturación</th>
                <th>Ganancia</th>
                <th>Margen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id}>
                  <td>{dateLabel(s.saleDate)}</td>
                  <td>
                    <strong>{s.customerName || "Venta sin cliente"}</strong>
                    <small>{s.customerPhone || "Dato pendiente"}</small>
                  </td>
                  <td>
                    <span className="soft-tag">{s.channel || "—"}</span>
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
  cashFlow,
  onAddExpense,
  onAddLoan,
  onAddReceivable,
  onEdit,
  onDone,
}: {
  expenses: any[];
  loans: any[];
  receivables: any[];
  cashFlow?: any;
  onAddExpense: () => void;
  onAddLoan: () => void;
  onAddReceivable: () => void;
  onEdit: (kind: string, item?: any) => void;
  onDone: () => void;
}) {
  const outstanding = loans.reduce((a, l) => a + Number(l.balance || 0), 0);
  const receivableTotal = receivables.reduce(
    (a, r) => a + Number(r.balance || 0),
    0
  );
  const spent = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const pay = trpc.business.payLoan.useMutation({
    onSuccess: () => {
      toast.success("Pago registrado");
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
        <div className="finance-stat cash-flow-main">
          <span>Caja neta estimada</span>
          <strong>{money(cashFlow?.net)}</strong>
          <small>Entradas cobradas menos gastos y publicidad</small>
        </div>
        <div className="finance-stat">
          <span>Por pagar</span>
          <strong>{money(outstanding)}</strong>
          <small>{loans.length} compromisos abiertos o históricos</small>
        </div>
        <div className="finance-stat danger-stat">
          <span>Por cobrar</span>
          <strong>{money(receivableTotal)}</strong>
          <small>{receivables.length} cuentas activas</small>
        </div>
        <div className="finance-stat">
          <span>Gastos cargados</span>
          <strong>{money(spent)}</strong>
          <small>Incluye operación y mentorías</small>
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
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td>{dateLabel(e.expenseDate)}</td>
                    <td>
                      <strong>{e.description}</strong>
                      <small>{e.category}</small>
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
                {loans.map(l => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.counterparty}</strong>
                      <small>
                        {l.description || l.notes || l.kind}
                        {l.kind === "loan" &&
                          ` · ${Number(l.interestRate || 0).toFixed(2)}% ${l.interestPeriod === "weekly" ? "semanal" : "mensual"}${l.hasDueDate === false ? " · capitaliza" : " · fijo"}`}
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
  ads,
  onAdd,
  onEdit,
  onDone,
}: {
  ads: any[];
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDone: () => void;
}) {
  const remove = trpc.business.deleteAd.useMutation({
    onSuccess: () => {
      toast.success("Registro publicitario eliminado");
      onDone();
    },
    onError: e => toast.error(e.message),
  });
  const total = ads.reduce((a, x) => a + Number(x.amount || 0), 0);
  return (
    <>
      <div className="view-intro">
        <div>
          <span className="eyebrow">adquisición y rendimiento</span>
          <h2>Publicidad</h2>
          <p className="muted">
            Registrá únicamente el gasto verificado. Las conversiones no se
            inventan ni se cargan a mano.
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} /> Publicidad
        </button>
      </div>
      <div className="data-note page-note">
        <strong>Meta Ads no está sincronizado todavía</strong>
        <small>
          El conector disponible necesita reautorización. Hasta entonces, el
          sistema mostrará gasto real registrado y conversiones como “No
          disponible”.
        </small>
      </div>
      <div className="finance-cards">
        <div className="finance-stat">
          <span>Inversión registrada</span>
          <strong>{money(total)}</strong>
          <small>{ads.length} movimientos</small>
        </div>
        <div className="finance-stat">
          <span>Conversiones</span>
          <strong>N/A</strong>
          <small>No disponible sin sincronización</small>
        </div>
        <div className="finance-stat">
          <span>Resultados atribuidos</span>
          <strong>N/A</strong>
          <small>No disponible sin sincronización</small>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Campaña</th>
                <th>Plataforma</th>
                <th>Gasto</th>
                <th>Conversiones</th>
                <th>Resultados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ads.map(a => (
                <tr key={a.id}>
                  <td>{dateLabel(a.adDate)}</td>
                  <td>
                    <strong>{a.campaign}</strong>
                  </td>
                  <td>
                    <span className="soft-tag">{a.platform}</span>
                  </td>
                  <td>{money(a.amount)}</td>
                  <td>N/A</td>
                  <td>N/A</td>
                  <td>
                    <RowActions
                      onEdit={() => onEdit(a)}
                      onDelete={() => remove.mutate({ id: a.id })}
                      deleteLabel={`la campaña ${a.campaign}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
