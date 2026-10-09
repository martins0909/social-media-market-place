import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  TrendingUp,
  RefreshCw,
  Percent,
  Loader2,
  Users,
  ShoppingBag,
  Wallet,
  Search,
  ExternalLink,
  BadgeDollarSign,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Service {
  service: string;
  name: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  averageTime?: string;
  description?: string;
  pricePer1000Ngn: number;
}

interface BoostOrder {
  _id?: string;
  userId: string;
  email: string;
  providerOrderId?: string;
  serviceId: string;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  ratePer1000Usd: number;
  priceUsd: number;
  priceNgn: number;
  status: string;
  startCount?: string;
  remains?: string;
  charge?: number;
  currency?: string;
  createdAt: string;
  updatedAt?: string;
}

interface BoostSettings {
  exchangeRate: number;
  markupPercentage: number;
  flatMarkupNgn: number;
}

type AdminBoostTab = "orders" | "services" | "refunds";

export default function AdminBoost() {
  const [tab, setTab] = useState<AdminBoostTab>("orders");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [orders, setOrders] = useState<BoostOrder[]>([]);
  const [refunds, setRefunds] = useState<BoostOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [settings, setSettings] = useState<BoostSettings>({
    exchangeRate: 1,
    markupPercentage: 0,
    flatMarkupNgn: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ords, refs, srvs, stg] = await Promise.all([
        apiFetch("/api/boost/admin/orders"),
        apiFetch("/api/boost/admin/refunds"),
        apiFetch("/api/boost/services"),
        apiFetch("/api/boost/settings"),
      ]);
      setOrders(ords || []);
      setRefunds(refs || []);
      const servicesData = srvs?.data;
      if (servicesData && typeof servicesData === "object") {
        setServices(Object.values(servicesData).flat() as Service[]);
      }
      if (stg) setSettings(stg);
    } catch (e) {
      toast.error("Failed to load boost admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/boost/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      toast.success("Settings updated");
      await fetchData();
    } catch (e) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const syncOrders = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch("/api/boost/admin/sync", { method: "POST" });
      toast.success(`Synced ${res.synced || 0} orders`);
      await fetchData();
    } catch (e) {
      toast.error("Failed to sync orders");
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : "—");

  const getStatusClass = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "completed" || s === "success" || s === "done") {
      return "text-green-600 dark:text-green-400 font-semibold";
    }
    if (s === "pending" || s === "in progress" || s === "processing") {
      return "text-amber-600 dark:text-amber-400 font-semibold";
    }
    if (s === "partial") {
      return "text-blue-600 dark:text-blue-400 font-semibold";
    }
    if (s === "cancelled" || s === "canceled" || s === "refunded") {
      return "text-gray-500 dark:text-gray-400";
    }
    if (s === "failed") {
      return "text-red-600 dark:text-red-400 font-semibold";
    }
    return "text-blue-600 dark:text-blue-400 font-semibold";
  };

  const totalRevenue = orders.reduce((sum, o) => sum + (o.priceNgn || 0), 0);
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) =>
    ["completed", "success", "done"].includes((o.status || "").toLowerCase())
  ).length;

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.service.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(
    (o) =>
      !orderSearch ||
      o.serviceName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.providerOrderId?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.email.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.link.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const renderSettings = () => (
    <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Percent className="h-5 w-5" />
        Pricing Settings
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Exchange Rate (provider currency → NGN)</label>
          <Input
            type="number"
            value={settings.exchangeRate}
            onChange={(e) => setSettings((s) => ({ ...s, exchangeRate: Number(e.target.value) }))}
          />
          <p className="text-xs text-gray-500 mt-1">Use 1 if provider already returns NGN rates.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Markup (%)</label>
          <Input
            type="number"
            value={settings.markupPercentage}
            onChange={(e) => setSettings((s) => ({ ...s, markupPercentage: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Flat Markup (₦ per 1,000)</label>
          <Input
            type="number"
            value={settings.flatMarkupNgn}
            onChange={(e) => setSettings((s) => ({ ...s, flatMarkupNgn: Number(e.target.value) }))}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={saveSettings} disabled={saving} className="bg-[#1565C0] hover:bg-[#0d4f9f]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Percent className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );

  const renderServices = () => (
    <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BadgeDollarSign className="h-5 w-5" />
          Services
        </h3>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search services..."
            value={serviceSearch}
            onChange={(e) => setServiceSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              <th className="text-left p-3 font-semibold">ID</th>
              <th className="text-left p-3 font-semibold">Service</th>
              <th className="text-left p-3 font-semibold">Rate / 1k</th>
              <th className="text-left p-3 font-semibold">Min</th>
              <th className="text-left p-3 font-semibold">Max</th>
              <th className="text-left p-3 font-semibold">Avg Time</th>
              <th className="text-left p-3 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.map((s) => (
              <tr key={s.service} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3 font-mono text-xs">{s.service}</td>
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 font-bold text-[#1565C0]">₦{s.pricePer1000Ngn.toLocaleString()}</td>
                <td className="p-3">{s.min.toLocaleString()}</td>
                <td className="p-3">{s.max.toLocaleString()}</td>
                <td className="p-3 text-gray-500">{s.averageTime || "—"}</td>
                <td className="p-3 text-gray-500 max-w-xs truncate">{s.description || "—"}</td>
              </tr>
            ))}
            {filteredServices.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No services found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="h-5 w-5" />
          Order History
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={syncOrders} disabled={syncing} variant="outline" size="sm">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              <th className="text-left p-3 font-semibold">Order ID</th>
              <th className="text-left p-3 font-semibold">Date</th>
              <th className="text-left p-3 font-semibold">User</th>
              <th className="text-left p-3 font-semibold">Link</th>
              <th className="text-left p-3 font-semibold">Charge</th>
              <th className="text-left p-3 font-semibold">Start</th>
              <th className="text-left p-3 font-semibold">Qty</th>
              <th className="text-left p-3 font-semibold">Service</th>
              <th className="text-left p-3 font-semibold">Status</th>
              <th className="text-left p-3 font-semibold">Remains</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <tr key={o._id || o.providerOrderId} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3 font-mono text-xs">{o.providerOrderId || "—"}</td>
                <td className="p-3">{formatDate(o.createdAt)}</td>
                <td className="p-3">
                  <div className="font-medium">{o.email}</div>
                  <div className="text-xs text-gray-500">{o.userId}</div>
                </td>
                <td className="p-3 max-w-[120px] truncate">
                  <button
                    onClick={() => window.open(o.link, "_blank", "noopener,noreferrer")}
                    className="text-[#1565C0] hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{o.link}</span>
                  </button>
                </td>
                <td className="p-3">
                  <div className="font-bold">₦{o.priceNgn.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">${o.priceUsd.toFixed(3)}</div>
                </td>
                <td className="p-3">{o.startCount ?? "—"}</td>
                <td className="p-3">{o.quantity.toLocaleString()}</td>
                <td className="p-3">
                  <div className="font-medium">{o.serviceName}</div>
                  <div className="text-xs text-gray-500">{o.category}</div>
                </td>
                <td className={`p-3 capitalize ${getStatusClass(o.status)}`}>{o.status}</td>
                <td className="p-3">{o.remains ?? "—"}</td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRefunds = () => (
    <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <RotateCcw className="h-5 w-5" />
        Refund History
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              <th className="text-left p-3 font-semibold">Order ID</th>
              <th className="text-left p-3 font-semibold">Refunded Amount</th>
              <th className="text-left p-3 font-semibold">Order Status</th>
              <th className="text-left p-3 font-semibold">Date</th>
              <th className="text-left p-3 font-semibold">User</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((o) => (
              <tr key={o._id || o.providerOrderId} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3 font-mono text-xs">{o.providerOrderId || "—"}</td>
                <td className="p-3 font-bold text-green-600">
                  {o.status.toLowerCase() === "partial" ? `Partial refund` : "—"}
                </td>
                <td className={`p-3 capitalize ${getStatusClass(o.status)}`}>{o.status}</td>
                <td className="p-3">{formatDate(o.createdAt)}</td>
                <td className="p-3">{o.email}</td>
              </tr>
            ))}
            {refunds.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No refunds found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {loading && orders.length === 0 && services.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <ShoppingBag className="h-4 w-4" />
                <span className="text-sm font-medium">Total Orders</span>
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{totalOrders}</div>
            </div>
            <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <div className="text-2xl font-black text-green-600">{completedOrders}</div>
            </div>
            <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-medium">Revenue</span>
              </div>
              <div className="text-2xl font-black text-[#1565C0]">₦{totalRevenue.toLocaleString()}</div>
            </div>
          </div>

          {renderSettings()}

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: "orders", label: "Orders", icon: Users },
              { key: "services", label: "Services", icon: BadgeDollarSign },
              { key: "refunds", label: "Refunds", icon: RotateCcw },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as AdminBoostTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  tab === t.key
                    ? "bg-[#1565C0] text-white"
                    : "bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "orders" && renderOrders()}
          {tab === "services" && renderServices()}
          {tab === "refunds" && renderRefunds()}
        </>
      )}
    </div>
  );
}
