import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Smartphone,
  CreditCard,
  History,
  Globe,
  Flag,
  RefreshCw,
  Copy,
  Loader2,
  Settings,
  Percent,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AdminNumbersView = "transactions" | "my-numbers" | "rentals" | "all-countries" | "usa" | "settings";
type ProviderFilter = "all" | "bloom" | "daisy";

interface Activation {
  _id?: string;
  userId: string;
  email: string;
  activationId: string;
  phoneNumber: string;
  serviceName?: string;
  countryName?: string;
  country: string;
  priceNgn: number;
  status: "waiting" | "code_received" | "completed" | "cancelled" | "failed";
  smsCode?: string;
  smsText?: string;
  expiresAt?: string;
  createdAt: string;
}

interface Rental {
  _id?: string;
  userId: string;
  email: string;
  rentalId: string;
  phoneNumber: string;
  serviceName?: string;
  period: string;
  priceNgn: number;
  status: "active" | "cancelled" | "expired";
  autoRenew: boolean;
  expiresAt: string;
  createdAt: string;
}

interface NumberTransaction {
  _id?: string;
  userId: string;
  email: string;
  reference: string;
  amount: number;
  type: "activation" | "rental" | "refund";
  method: string;
  status: string;
  createdAt: string;
}

interface NumberSettings {
  markupPercentage: number;
  exchangeRate: number;
  boostMarkupPercentage: number;
}

export default function AdminNumbers() {
  const [view, setView] = useState<AdminNumbersView>("transactions");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [activations, setActivations] = useState<Activation[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [transactions, setTransactions] = useState<NumberTransaction[]>([]);
  const [settings, setSettings] = useState<NumberSettings>({ markupPercentage: 0, exchangeRate: 1500, boostMarkupPercentage: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ProviderBadge = ({ provider }: { provider: string }) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${provider === "bloom" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"}`}>
      {provider}
    </span>
  );

  const filteredActivations = activations.filter((a) => providerFilter === "all" || a.provider === providerFilter);
  const filteredRentals = rentals.filter((r) => providerFilter === "all" || r.provider === providerFilter);
  const filteredTransactions = transactions.filter((t) => providerFilter === "all" || t.provider === providerFilter);

  const menuItems: { key: AdminNumbersView; label: string; icon: React.ElementType }[] = [
    { key: "transactions", label: "Transaction History", icon: CreditCard },
    { key: "my-numbers", label: "My Numbers", icon: Smartphone },
    { key: "rentals", label: "Rentals", icon: History },
    { key: "all-countries", label: "All Countries", icon: Globe },
    { key: "usa", label: "USA Numbers", icon: Flag },
    { key: "settings", label: "Markup Settings", icon: Settings },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [acts, rnts, txs, stg] = await Promise.all([
        apiFetch("/api/numbers/admin/activations"),
        apiFetch("/api/numbers/admin/rentals"),
        apiFetch("/api/numbers/admin/transactions"),
        apiFetch("/api/numbers/settings"),
      ]);
      setActivations(acts || []);
      setRentals(rnts || []);
      setTransactions(txs || []);
      if (stg) setSettings(stg);
    } catch (e) {
      toast.error("Failed to load number admin data");
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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied");
  };

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleString() : "—");

  const getRemainingTime = (expiresAt?: string) => {
    if (!expiresAt) return "—";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const getActivationStatusDisplay = (a: Activation) => {
    if (a.smsCode && (a.status === "code_received" || a.status === "completed")) {
      return { label: "Successful", className: "text-green-600 dark:text-green-400 font-semibold" };
    }
    switch (a.status) {
      case "waiting":
        return { label: "Pending", className: "text-amber-600 dark:text-amber-400 font-semibold" };
      case "code_received":
      case "completed":
        return { label: "Successful", className: "text-green-600 dark:text-green-400 font-semibold" };
      case "cancelled":
        return { label: "Cancelled", className: "text-gray-500 dark:text-gray-400" };
      case "failed":
        return { label: "Failed", className: "text-red-600 dark:text-red-400 font-semibold" };
      default:
        return { label: a.status, className: "text-gray-500 dark:text-gray-400" };
    }
  };

  const renderTransactions = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900">
          <tr>
            <th className="text-left p-3 font-semibold">Provider</th>
            <th className="text-left p-3 font-semibold">Reference</th>
            <th className="text-left p-3 font-semibold">Amount</th>
            <th className="text-left p-3 font-semibold">Type</th>
            <th className="text-left p-3 font-semibold">Method</th>
            <th className="text-left p-3 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.map((t) => (
            <tr key={t._id || t.reference} className="border-b border-gray-100 dark:border-gray-800">
              <td className="p-3"><ProviderBadge provider={t.provider} /></td>
              <td className="p-3 font-mono">{t.reference}</td>
              <td className="p-3">₦{t.amount.toLocaleString()}</td>
              <td className="p-3 capitalize">{t.type}</td>
              <td className="p-3 capitalize">{t.method}</td>
              <td className="p-3">{formatDate(t.createdAt)}</td>
            </tr>
          ))}
          {filteredTransactions.length === 0 && (
            <tr><td colSpan={6} className="p-6 text-center text-gray-500">No transactions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderActivationsTable = (data: Activation[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900">
          <tr>
            <th className="text-left p-3 font-semibold">Provider</th>
            <th className="text-left p-3 font-semibold">Service</th>
            <th className="text-left p-3 font-semibold">Number</th>
            <th className="text-left p-3 font-semibold">OTP Code</th>
            <th className="text-left p-3 font-semibold">Status</th>
            <th className="text-left p-3 font-semibold">Timer</th>
            <th className="text-left p-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a) => {
            const statusDisplay = getActivationStatusDisplay(a);
            return (
              <tr key={a._id || a.activationId} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3"><ProviderBadge provider={a.provider} /></td>
                <td className="p-3">{a.serviceName || a.activationId}</td>
                <td className="p-3 font-mono">{a.phoneNumber}</td>
                <td className="p-3">
                  {a.smsCode ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-green-600">{a.smsCode}</span>
                      <button onClick={() => copyCode(a.smsCode!)} className="text-gray-400 hover:text-gray-600">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-amber-600">Waiting...</span>
                  )}
                </td>
                <td className={`p-3 capitalize ${statusDisplay.className}`}>{statusDisplay.label}</td>
                <td className="p-3">{getRemainingTime(a.expiresAt)}</td>
                <td className="p-3">
                  <button
                    onClick={() => copyCode(a.phoneNumber)}
                    className="text-[#1565C0] hover:underline text-xs"
                  >
                    Copy number
                  </button>
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr><td colSpan={7} className="p-6 text-center text-gray-500">No numbers found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderRentals = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 dark:bg-gray-900">
          <tr>
            <th className="text-left p-3 font-semibold">Provider</th>
            <th className="text-left p-3 font-semibold">Service</th>
            <th className="text-left p-3 font-semibold">Number</th>
            <th className="text-left p-3 font-semibold">Expires At</th>
            <th className="text-left p-3 font-semibold">Status</th>
            <th className="text-left p-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredRentals.map((r) => (
            <tr key={r._id || r.rentalId} className="border-b border-gray-100 dark:border-gray-800">
              <td className="p-3"><ProviderBadge provider={r.provider} /></td>
              <td className="p-3">{r.serviceName || r.rentalId}</td>
              <td className="p-3 font-mono">{r.phoneNumber}</td>
              <td className="p-3">{formatDate(r.expiresAt)}</td>
              <td className="p-3 capitalize">{r.status}</td>
              <td className="p-3">
                <button
                  onClick={() => copyCode(r.phoneNumber)}
                  className="text-[#1565C0] hover:underline text-xs"
                >
                  Copy number
                </button>
              </td>
            </tr>
          ))}
          {filteredRentals.length === 0 && (
            <tr><td colSpan={6} className="p-6 text-center text-gray-500">No rentals found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-md space-y-4 p-2">
      <div>
        <label className="block text-sm font-medium mb-1">Exchange Rate (USD → NGN)</label>
        <Input
          type="number"
          value={settings.exchangeRate}
          onChange={(e) => setSettings((s) => ({ ...s, exchangeRate: Number(e.target.value) }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Numbers Markup Percentage (%)</label>
        <Input
          type="number"
          value={settings.markupPercentage}
          onChange={(e) => setSettings((s) => ({ ...s, markupPercentage: Number(e.target.value) }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Boost Markup Percentage (%)</label>
        <Input
          type="number"
          value={settings.boostMarkupPercentage}
          onChange={(e) => setSettings((s) => ({ ...s, boostMarkupPercentage: Number(e.target.value) }))}
        />
      </div>
      <Button onClick={saveSettings} disabled={saving} className="bg-[#1565C0] hover:bg-[#0d4f9f]">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Percent className="h-4 w-4 mr-2" />}
        Save Settings
      </Button>
    </div>
  );

  const viewData: Record<AdminNumbersView, { title: string; content: React.ReactNode }> = {
    transactions: { title: "Transaction History", content: renderTransactions() },
    "my-numbers": { title: "My Numbers", content: renderActivationsTable(filteredActivations) },
    rentals: { title: "Rentals", content: renderRentals() },
    "all-countries": { title: "All Countries", content: renderActivationsTable(filteredActivations) },
    usa: { title: "USA Numbers", content: renderActivationsTable(filteredActivations.filter((a) => a.country === "187")) },
    settings: { title: "Markup Settings", content: renderSettings() },
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[60vh]">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  view === item.key
                    ? "bg-[#1565C0] text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 bg-white dark:bg-[#101820] rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{viewData[view].title}</h2>
          <div className="flex items-center gap-2">
            {view !== "settings" && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
                {(["all", "bloom", "daisy"] as ProviderFilter[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProviderFilter(p)}
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors ${
                      providerFilter === p
                        ? p === "bloom"
                          ? "bg-blue-500 text-white"
                          : p === "daisy"
                          ? "bg-pink-500 text-white"
                          : "bg-gray-800 text-white dark:bg-gray-700"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
          </div>
        ) : (
          viewData[view].content
        )}
      </div>
    </div>
  );
}
