import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Users,
  History,
  X,
  Loader2,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  Check,
} from "lucide-react";

interface BoostFollowersProps {
  user: { id: string; email: string; balance: number } | null;
  onClose: () => void;
  onBalanceChange?: (balance: number) => void;
}

type View = "home" | "category" | "order" | "success" | "my-orders";

interface Service {
  service: string;
  name: string;
  type?: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  refill?: string;
  cancel?: string;
  pricePer1000Ngn: number;
  minPriceNgn: number;
}

interface Order {
  _id?: string;
  providerOrderId?: string;
  serviceId: string;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  priceNgn: number;
  status: string;
  startCount?: string;
  remains?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function BoostFollowers({ user, onClose, onBalanceChange }: BoostFollowersProps) {
  const [view, setView] = useState<View>("home");
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, Service[]>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastOrder, setLastOrder] = useState<{ orderId: string; priceNgn: number; quantity: number } | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  const isLoggedIn = !!user?.id;

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/boost/services");
      const data = res?.data;
      if (data && typeof data === "object") {
        setServicesByCategory(data);
        const cats = Object.keys(data);
        if (cats.length > 0 && !selectedCategory) {
          setSelectedCategory(cats[0]);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load boost services");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!user?.id) return;
    try {
      const res = await apiFetch(`/api/boost/orders/${user.id}`);
      if (Array.isArray(res)) setOrders(res);
    } catch (e) {
      console.error("Failed to load boost orders", e);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchOrders();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  // Poll pending orders every 10 seconds while on My Orders
  useEffect(() => {
    if (view !== "my-orders" || !user?.id) {
      if (pollTimer.current) clearInterval(pollTimer.current);
      return;
    }

    const poll = async () => {
      for (const order of orders) {
        if (order.providerOrderId && isPendingStatus(order.status)) {
          try {
            await apiFetch(`/api/boost/orders/status/${order.providerOrderId}`);
          } catch (e) {
            console.error("Boost poll error", e);
          }
        }
      }
      await fetchOrders();
    };

    poll();
    pollTimer.current = setInterval(poll, 10000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [view, orders.length, user?.id]);

  const isPendingStatus = (status?: string) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === "pending" || s === "in progress" || s === "in_progress" || s === "processing";
  };

  const allServices = Object.values(servicesByCategory).flat();
  const filteredCategories = Object.keys(servicesByCategory).filter((cat) =>
    cat.toLowerCase().includes(search.toLowerCase()) ||
    servicesByCategory[cat].some((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.service.toLowerCase().includes(search.toLowerCase())
    )
  );

  const filteredServicesInCategory = selectedCategory
    ? servicesByCategory[selectedCategory]?.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.service.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setQuantity(String(service.min || 100));
    setView("order");
  };

  const totalNgn = () => {
    if (!selectedService) return 0;
    const qty = Number(quantity) || 0;
    const usd = (selectedService.rate * qty) / 1000;
    return Math.ceil(usd * 1500); // rough client calc; backend is authoritative
  };

  const handlePlaceOrder = async () => {
    if (!isLoggedIn) {
      toast.error("Please sign in");
      return;
    }
    if (!selectedService) return;
    const qty = Number(quantity);
    if (!qty || qty < selectedService.min) {
      toast.error(`Minimum quantity is ${selectedService.min}`);
      return;
    }
    if (selectedService.max && qty > selectedService.max) {
      toast.error(`Maximum quantity is ${selectedService.max}`);
      return;
    }
    if (!link.trim()) {
      toast.error("Please enter a valid link");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/boost/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user!.id,
          serviceId: selectedService.service,
          serviceName: selectedService.name,
          category: selectedService.category,
          link: link.trim(),
          quantity: qty,
          ratePer1000Usd: selectedService.rate,
        }),
      });

      if (res.ok && res.orderId) {
        toast.success("Boost order placed");
        setLastOrder({ orderId: res.orderId, priceNgn: res.priceNgn, quantity: qty });
        if (onBalanceChange) onBalanceChange(res.newBalance);
        setLink("");
        setQuantity("");
        setSelectedService(null);
        await fetchOrders();
        setView("success");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  const refreshOrders = async () => {
    setLoading(true);
    await fetchOrders();
    setLoading(false);
    toast.success("Orders refreshed");
  };

  const renderHeader = (title: string, backTo?: View) => (
    <div className="flex items-center gap-3 mb-4">
      <button
        onClick={() => (backTo ? setView(backTo) : onClose())}
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
        <h2 className="text-xl font-black text-gray-900 dark:text-white">Boost Followers</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>

      <button
        onClick={() => setView("category")}
        className="w-full flex items-center gap-4 rounded-2xl p-5 text-white shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-r from-violet-500 to-fuchsia-600"
      >
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div className="text-left flex-1">
          <div className="font-bold text-lg">Browse Services</div>
          <div className="text-xs text-white/80">Instagram, TikTok, Twitter & more</div>
        </div>
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="space-y-2">
        <button
          onClick={() => setView("my-orders")}
          className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white">My Orders</div>
              <div className="text-xs text-gray-500">Track your boost orders</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>How it works:</strong> Select a service, paste your profile/post link, choose quantity, and pay from your wallet. Delivery starts instantly.
        </p>
      </div>
    </div>
  );

  const renderCategory = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("Services", "home")}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
        />
      </div>

      {loading && Object.keys(servicesByCategory).length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
        </div>
      ) : (
        <div className="space-y-4 pb-20">
          {/* Category selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {Object.keys(servicesByCategory).map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setSearch(""); }}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                  selectedCategory === cat
                    ? "bg-[#1565C0] text-white"
                    : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredServicesInCategory.map((s) => (
              <button
                key={s.service}
                onClick={() => handleSelectService(s)}
                className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900 dark:to-fuchsia-900 flex items-center justify-center text-lg">
                    {getServiceIcon(s.category)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500">
                      Min {s.min} · Max {s.max?.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#1565C0]">₦{s.pricePer1000Ngn.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">per 1,000</div>
                </div>
              </button>
            ))}
            {filteredServicesInCategory.length === 0 && (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                {search ? "No matching services" : "Select a category"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderOrderForm = () => {
    if (!selectedService) return null;
    const qty = Number(quantity) || 0;
    const total = selectedService.pricePer1000Ngn * (qty / 1000);

    return (
      <div className="animate-in fade-in duration-300">
        {renderHeader("Place Order", "category")}
        <div className="space-y-4 pb-20">
          <div className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white p-4">
            <div className="text-xs text-white/80 uppercase tracking-wider font-bold">Selected Service</div>
            <div className="font-bold text-lg">{selectedService.name}</div>
            <div className="text-xs text-white/80">{selectedService.category}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Link</label>
            <Input
              placeholder="https://instagram.com/username or post link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="h-12 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
            />
            <p className="text-xs text-gray-500">Paste the profile or post URL you want to boost.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
            <Input
              type="number"
              min={selectedService.min}
              max={selectedService.max}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Min: {selectedService.min.toLocaleString()}</span>
              <span>Max: {selectedService.max?.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rate</span>
              <span className="font-medium">₦{selectedService.pricePer1000Ngn.toLocaleString()} / 1,000</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Quantity</span>
              <span className="font-medium">{qty.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-xl font-black text-[#1565C0]">₦{Math.ceil(total).toLocaleString()}</span>
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={loading || !link.trim() || qty < selectedService.min}
            className="w-full h-12 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-bold rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Pay & Place Order
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 animate-in fade-in duration-300">
      <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
        <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Order Placed!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your order is being processed. Track it in My Orders.
        </p>
      </div>
      {lastOrder && (
        <div className="rounded-xl bg-gray-50 dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4 w-full max-w-xs text-left space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order ID</span>
            <span className="font-mono font-medium">{lastOrder.orderId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Quantity</span>
            <span className="font-medium">{lastOrder.quantity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Paid</span>
            <span className="font-bold text-[#1565C0]">₦{lastOrder.priceNgn.toLocaleString()}</span>
          </div>
        </div>
      )}
      <div className="flex gap-3 w-full max-w-xs">
        <Button
          variant="outline"
          onClick={() => setView("home")}
          className="flex-1 h-11 rounded-xl"
        >
          Home
        </Button>
        <Button
          onClick={() => setView("my-orders")}
          className="flex-1 h-11 rounded-xl bg-[#1565C0] hover:bg-[#0d4f9f] text-white"
        >
          My Orders
        </Button>
      </div>
    </div>
  );

  const renderMyOrders = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("My Orders", "home")}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Status updates happen automatically.
        </p>
        <button
          onClick={refreshOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1565C0] text-white text-xs font-semibold disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>
      <div className="space-y-3 pb-20">
        {orders.map((o) => (
          <div
            key={o._id || o.providerOrderId}
            className="rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-gray-900 dark:text-white text-sm">{o.serviceName}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusClass(o.status)}`}>
                {o.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {o.category} · {new Date(o.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">Quantity</div>
                <div className="font-semibold text-sm">{o.quantity.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Paid</div>
                <div className="font-bold text-[#1565C0]">₦{o.priceNgn.toLocaleString()}</div>
              </div>
            </div>
            {o.providerOrderId && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-mono text-gray-500">ID: {o.providerOrderId}</span>
                <button
                  onClick={() => window.open(o.link, "_blank", "noopener,noreferrer")}
                  className="flex items-center gap-1 text-xs text-[#1565C0] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Link
                </button>
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No orders yet. Browse services to get started.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 dark:bg-black flex flex-col pt-[60px] pb-[80px]">
      <div className="flex-1 overflow-y-auto p-4">
        {view === "home" && renderHome()}
        {view === "category" && renderCategory()}
        {view === "order" && renderOrderForm()}
        {view === "success" && renderSuccess()}
        {view === "my-orders" && renderMyOrders()}
      </div>
    </div>
  );
}

function getServiceIcon(category: string) {
  const c = category.toLowerCase();
  if (c.includes("instagram")) return "📸";
  if (c.includes("tiktok")) return "🎵";
  if (c.includes("twitter") || c.includes("x")) return "🐦";
  if (c.includes("youtube")) return "▶️";
  if (c.includes("facebook")) return "📘";
  if (c.includes("telegram")) return "✈️";
  if (c.includes("whatsapp")) return "💬";
  if (c.includes("spotify")) return "🎧";
  return "🚀";
}

function getStatusClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "success" || s === "done") {
    return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
  }
  if (s === "pending" || s === "in progress" || s === "processing") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  }
  if (s === "cancelled" || s === "canceled" || s === "refunded") {
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
  if (s === "failed") {
    return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  }
  return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
}
