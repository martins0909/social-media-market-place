import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Globe,
  Flag,
  Smartphone,
  Clock,
  RefreshCw,
  Copy,
  Check,
  ShoppingCart,
  History,
  Calendar,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";

interface BuyNumbersProps {
  user: { id: string; email: string; balance: number } | null;
  onClose: () => void;
  onBalanceChange?: (balance: number) => void;
}

type View = "home" | "us" | "international" | "country" | "my-numbers" | "history" | "rentals";

interface Country {
  id: string;
  name: string;
}

interface Service {
  code: string;
  name: string;
  price: string;
  priceNgn: number;
  stock: number;
}

interface Activation {
  _id?: string;
  activationId: string;
  phoneNumber: string;
  serviceName?: string;
  countryName?: string;
  priceNgn: number;
  status: "waiting" | "code_received" | "completed" | "cancelled";
  smsCode?: string;
  smsText?: string;
  expiresAt?: string;
  createdAt: string;
}

interface Rental {
  _id?: string;
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
  reference: string;
  amount: number;
  type: "activation" | "rental" | "refund";
  method: string;
  status: string;
  createdAt: string;
}

const DEFAULT_COUNTRY = "187"; // USA in BloomSMS

export default function BuyNumbers({ user, onClose, onBalanceChange }: BuyNumbersProps) {
  const [view, setView] = useState<View>("home");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [transactions, setTransactions] = useState<NumberTransaction[]>([]);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const isLoggedIn = !!user?.id;

  const fetchCountries = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/numbers/countries");
      if (res?.status === "success" && Array.isArray(res.data?.countries)) {
        setCountries(res.data.countries);
      }
    } catch (e) {
      toast.error("Failed to load countries");
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async (countryId: string) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/numbers/services?country=${countryId}`);
      if (res?.status === "success" && Array.isArray(res.data?.services)) {
        setServices(res.data.services);
      }
    } catch (e) {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    if (!user?.id) return;
    try {
      const [acts, rnts, txs] = await Promise.all([
        apiFetch(`/api/numbers/activations/${user.id}`),
        apiFetch(`/api/numbers/rentals/${user.id}`),
        apiFetch(`/api/numbers/transactions/${user.id}`),
      ]);
      setActivations(acts || []);
      setRentals(rnts || []);
      setTransactions(txs || []);
    } catch (e) {
      console.error("Failed to load user number data", e);
    }
  };

  useEffect(() => {
    fetchCountries();
    fetchUserData();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (view === "us") fetchServices(DEFAULT_COUNTRY);
    if (view === "country" && selectedCountry) fetchServices(selectedCountry.id);
  }, [view, selectedCountry]);

  useEffect(() => {
    if (pollingId) {
      pollTimer.current = setInterval(async () => {
        try {
          const res = await apiFetch(`/api/numbers/activations/status/${pollingId}`);
          const local = res?.local;
          if (local?.smsCode) {
            toast.success(`Code received: ${local.smsCode}`);
            setPollingId(null);
            fetchUserData();
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 4000);
      return () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
      };
    }
  }, [pollingId]);

  const handleRent = async (service: Service) => {
    if (!isLoggedIn) {
      toast.error("Please sign in to rent a number");
      return;
    }
    const countryId = view === "us" ? DEFAULT_COUNTRY : selectedCountry?.id || DEFAULT_COUNTRY;
    const countryName = view === "us" ? "United States" : selectedCountry?.name || "";
    try {
      setLoading(true);
      const res = await apiFetch("/api/numbers/activations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user!.id,
          service: service.code,
          country: countryId,
          serviceName: service.name,
          countryName,
        }),
      });
      if (res.ok && res.activation) {
        toast.success(`Number rented: ${res.activation.phoneNumber}`);
        setActivations((prev) => [res.activation, ...prev]);
        setTransactions((prev) => [
          {
            reference: `TXN_${Date.now()}`,
            amount: res.activation.priceNgn,
            type: "activation",
            method: "wallet",
            status: "completed",
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        if (onBalanceChange) onBalanceChange(res.newBalance);
        setPollingId(res.activation.activationId);
        setView("my-numbers");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to rent number");
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleString() : "—";

  const renderHeader = (title: string, backTo: View = "home") => (
    <div className="flex items-center gap-3 mb-4">
      <button
        onClick={() => setView(backTo)}
        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
      </button>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
    </div>
  );

  const renderHome = () => (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Buy Numbers</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView("us")}
          className="flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg active:scale-[0.98] transition-transform"
        >
          <span className="text-3xl">🇺🇸</span>
          <div className="text-left">
            <div className="font-bold">US Numbers</div>
            <div className="text-xs text-white/80">Virtual SMS numbers</div>
          </div>
        </button>

        <button
          onClick={() => { setSearch(""); setView("international"); }}
          className="flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg active:scale-[0.98] transition-transform"
        >
          <Globe className="h-8 w-8" />
          <div className="text-left">
            <div className="font-bold">International</div>
            <div className="text-xs text-white/80">160+ countries</div>
          </div>
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => setView("my-numbers")}
          className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white">My Numbers</div>
              <div className="text-xs text-gray-500">Active numbers & OTPs</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>

        <button
          onClick={() => setView("history")}
          className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white">Purchase History</div>
              <div className="text-xs text-gray-500">Past number orders</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>

        <button
          onClick={() => setView("rentals")}
          className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white">Rentals</div>
              <div className="text-xs text-gray-500">Long-term numbers</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
      </div>
    </div>
  );

  const renderServiceList = (title: string, countryName?: string) => (
    <div className="animate-in fade-in duration-300">
      {renderHeader(title)}
      {countryName && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">SMS verification numbers for {countryName}</p>
      )}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search services (WhatsApp, Telegram...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {filteredServices.map((s) => (
            <div
              key={s.code}
              className="flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg">
                  {s.name.toLowerCase().includes("whatsapp") ? "💬" : s.name.toLowerCase().includes("telegram") ? "✈️" : "📱"}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.stock?.toLocaleString()} pcs</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-bold text-[#1565C0]">₦{s.priceNgn.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">${s.price}</div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRent(s)}
                  disabled={loading || !isLoggedIn}
                  className="bg-[#1565C0] hover:bg-[#0d4f9f] text-white"
                >
                  Buy
                </Button>
              </div>
            </div>
          ))}
          {filteredServices.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">No services found</div>
          )}
        </div>
      )}
    </div>
  );

  const renderInternational = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("International Numbers")}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setView("us")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold"
        >
          <span>🇺🇸</span> US Numbers
        </button>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
        </div>
      ) : (
        <div className="space-y-2 pb-20">
          {filteredCountries.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedCountry(c); setSearch(""); setView("country"); }}
              className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-gray-500" />
                <span className="font-medium text-gray-900 dark:text-white text-sm">{c.name}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          ))}
          {filteredCountries.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">No countries found</div>
          )}
        </div>
      )}
    </div>
  );

  const renderMyNumbers = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("My Numbers", "home")}
      <div className="space-y-3 pb-20">
        {activations.map((a) => (
          <div key={a._id || a.activationId} className="rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-gray-900 dark:text-white">{a.phoneNumber}</div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  a.status === "code_received"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : a.status === "waiting"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {a.status.replace("_", " ")}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-3">{a.serviceName} · {a.countryName || ""} · Expires {formatDate(a.expiresAt)}</div>
            {a.smsCode ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-950/30 p-3 border border-green-200 dark:border-green-900">
                <div>
                  <div className="text-xs text-green-700 dark:text-green-400 font-semibold">OTP Code</div>
                  <div className="text-lg font-mono font-bold text-green-800 dark:text-green-300">{a.smsCode}</div>
                </div>
                <button
                  onClick={() => copyCode(a.smsCode!)}
                  className="p-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <Clock className="h-4 w-4 animate-pulse" />
                Waiting for SMS...
              </div>
            )}
          </div>
        ))}
        {activations.length === 0 && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No active numbers. Rent one to get started.
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("Purchase History", "home")}
      <div className="space-y-2 pb-20">
        {transactions.map((t) => (
          <div key={t._id || t.reference} className="flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-3">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm capitalize">{t.type}</div>
              <div className="text-xs text-gray-500">{formatDate(t.createdAt)}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#1565C0]">₦{t.amount.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{t.reference}</div>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">No purchase history</div>
        )}
      </div>
    </div>
  );

  const renderRentals = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("Rentals", "home")}
      <div className="space-y-3 pb-20">
        {rentals.map((r) => (
          <div key={r._id || r.rentalId} className="rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-gray-900 dark:text-white">{r.phoneNumber}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                {r.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-2">{r.serviceName} · {r.period} · Expires {formatDate(r.expiresAt)}</div>
            <div className="text-sm font-medium text-[#1565C0]">₦{r.priceNgn.toLocaleString()}</div>
          </div>
        ))}
        {rentals.length === 0 && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">No rentals yet</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 dark:bg-black flex flex-col pt-[60px] pb-[80px]">
      <div className="flex-1 overflow-y-auto p-4">
        {view === "home" && renderHome()}
        {view === "us" && renderServiceList("US Numbers", "United States")}
        {view === "international" && renderInternational()}
        {view === "country" && selectedCountry && renderServiceList(selectedCountry.name, selectedCountry.name)}
        {view === "my-numbers" && renderMyNumbers()}
        {view === "history" && renderHistory()}
        {view === "rentals" && renderRentals()}
      </div>
    </div>
  );
}
