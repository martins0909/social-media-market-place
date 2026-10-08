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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  markupPercentage: number;
  exchangeRate: number;
  boostMarkupPercentage: number;
}

export default function AdminBoost() {
  const [orders, setOrders] = useState<BoostOrder[]>([]);
  const [settings, setSettings] = useState<BoostSettings>({
    markupPercentage: 0,
    exchangeRate: 1500,
    boostMarkupPercentage: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ords, stg] = await Promise.all([
        apiFetch("/api/boost/admin/orders"),
        apiFetch("/api/numbers/settings"),
      ]);
      setOrders(ords || []);
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
      await apiFetch("/api/numbers/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      toast.success("Settings updated");
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

  return (
    <div className="space-y-6">
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

      {/* Settings */}
      <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Pricing Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div>
            <label className="block text-sm font-medium mb-1">Exchange Rate (USD → NGN)</label>
            <Input
              type="number"
              value={settings.exchangeRate}
              onChange={(e) => setSettings((s) => ({ ...s, exchangeRate: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Boost Markup (%)</label>
            <Input
              type="number"
              value={settings.boostMarkupPercentage}
              onChange={(e) => setSettings((s) => ({ ...s, boostMarkupPercentage: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={saveSettings} disabled={saving} className="bg-[#1565C0] hover:bg-[#0d4f9f]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Percent className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            Order History
          </h3>
          <Button onClick={syncOrders} disabled={syncing} variant="outline" size="sm">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Pending
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-900">
                <tr>
                  <th className="text-left p-3 font-semibold">Order ID</th>
                  <th className="text-left p-3 font-semibold">User</th>
                  <th className="text-left p-3 font-semibold">Service</th>
                  <th className="text-left p-3 font-semibold">Qty</th>
                  <th className="text-left p-3 font-semibold">Price</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id || o.providerOrderId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="p-3 font-mono text-xs">{o.providerOrderId || "—"}</td>
                    <td className="p-3">
                      <div className="font-medium">{o.email}</div>
                      <div className="text-xs text-gray-500">{o.userId}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.serviceName}</div>
                      <div className="text-xs text-gray-500">{o.category}</div>
                    </td>
                    <td className="p-3">{o.quantity.toLocaleString()}</td>
                    <td className="p-3">
                      <div className="font-medium">₦{o.priceNgn.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">${o.priceUsd.toFixed(3)}</div>
                    </td>
                    <td className={`p-3 capitalize ${getStatusClass(o.status)}`}>{o.status}</td>
                    <td className="p-3">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-500">
                      No boost orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
