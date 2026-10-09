import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Wallet,
  BadgeDollarSign,
  RotateCcw,
} from "lucide-react";

interface BoostFollowersProps {
  user: { id: string; email: string; balance: number } | null;
  onClose: () => void;
  onBalanceChange?: (balance: number) => void;
}

type View = "home" | "new-order" | "services" | "success" | "my-orders" | "refunds";
type OrderTab = "All" | "Pending" | "In progress" | "Completed" | "Partial" | "Processing" | "Canceled";
type RefundTab = "All" | "Canceled" | "Partial";

interface Service {
  service: string;
  name: string;
  type?: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  averageTime?: string;
  description?: string;
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
  priceUsd: number;
  priceNgn: number;
  status: string;
  startCount?: string;
  remains?: string;
  charge?: number;
  createdAt: string;
  updatedAt?: string;
}

const ORDER_TABS: OrderTab[] = ["All", "Pending", "In progress", "Completed", "Partial", "Processing", "Canceled"];
const REFUND_TABS: RefundTab[] = ["All", "Canceled", "Partial"];

export default function BoostFollowers({ user, onClose, onBalanceChange }: BoostFollowersProps) {
  const [view, setView] = useState<View>("home");
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, Service[]>>({});
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Order[]>([]);
  const [lastOrder, setLastOrder] = useState<{ orderId: string; priceNgn: number; quantity: number } | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  // New order form state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState<string>("");

  // Search / tabs
  const [serviceSearch, setServiceSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderTab, setOrderTab] = useState<OrderTab>("All");
  const [refundTab, setRefundTab] = useState<RefundTab>("All");

  const isLoggedIn = !!user?.id;
  const allServices = Object.values(servicesByCategory).flat();
  const selectedService = allServices.find((s) => s.service === selectedServiceId) || null;
  const categories = Object.keys(servicesByCategory).sort();

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
      const [ords, refs] = await Promise.all([
        apiFetch(`/api/boost/orders/${user.id}`),
        apiFetch(`/api/boost/refunds/${user.id}`),
      ]);
      if (Array.isArray(ords)) setOrders(ords);
      if (Array.isArray(refs)) setRefunds(refs);
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

  // Reset new-order form when category changes
  useEffect(() => {
    if (view === "new-order") {
      setSelectedServiceId("");
      setQuantity("");
    }
  }, [selectedCategory, view]);

  // Auto-quantity min when service selected
  useEffect(() => {
    if (selectedService && !quantity) {
      setQuantity(String(selectedService.min));
    }
  }, [selectedServiceId]);

  const isPendingStatus = (status?: string) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === "pending" || s === "in progress" || s === "in_progress" || s === "processing";
  };

  const totalNgn = () => {
    if (!selectedService) return 0;
    const qty = Number(quantity) || 0;
    return Math.ceil((selectedService.pricePer1000Ngn * qty) / 1000);
  };

  const handlePlaceOrder = async () => {
    if (!isLoggedIn) {
      toast.error("Please sign in");
      return;
    }
    if (!selectedService) {
      toast.error("Please select a service");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty < selectedService.min) {
      toast.error(`Minimum quantity is ${selectedService.min.toLocaleString()}`);
      return;
    }
    if (selectedService.max && qty > selectedService.max) {
      toast.error(`Maximum quantity is ${selectedService.max.toLocaleString()}`);
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
        setSelectedServiceId("");
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

  const filteredServices = allServices.filter(
    (s) =>
      s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.service.toLowerCase().includes(serviceSearch.toLowerCase()) ||
      s.category.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const filteredOrders = orders.filter((o) => {
    const matchesTab = orderTab === "All" || o.status.toLowerCase() === orderTab.toLowerCase();
    const matchesSearch =
      !orderSearch ||
      o.serviceName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.providerOrderId?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.link.toLowerCase().includes(orderSearch.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const filteredRefunds = refunds.filter((o) => {
    const matchesTab = refundTab === "All" || o.status.toLowerCase() === refundTab.toLowerCase();
    return matchesTab;
  });

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
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">Boost Followers</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Grow your social media accounts instantly</p>
        </div>
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
          onClick={() => setView("new-order")}
          className="flex flex-col items-start gap-3 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-br from-violet-500 to-fuchsia-600"
        >
          <ShoppingCart className="h-7 w-7" />
          <div className="text-left">
            <div className="font-bold">New Order</div>
            <div className="text-xs text-white/80">Place a boost order</div>
          </div>
        </button>

        <button
          onClick={() => setView("services")}
          className="flex flex-col items-start gap-3 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-transform bg-gradient-to-br from-blue-500 to-indigo-600"
        >
          <BadgeDollarSign className="h-7 w-7" />
          <div className="text-left">
            <div className="font-bold">Services</div>
            <div className="text-xs text-white/80">View all services & prices</div>
          </div>
        </button>
      </div>

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
              <div className="text-xs text-gray-500">Track all your orders</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>

        <button
          onClick={() => setView("refunds")}
          className="w-full flex items-center justify-between rounded-xl bg-white dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900 dark:text-white">Refunds</div>
              <div className="text-xs text-gray-500">Canceled & partial orders</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>How it works:</strong> Select a service, paste your profile or post link, choose quantity, and pay from your wallet. Delivery usually starts within minutes.
        </p>
      </div>
    </div>
  );

  const renderServices = () => (
    <div className="animate-in fade-in duration-300">
      {renderHeader("Services", "home")}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search services..."
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
        />
      </div>

      {loading && allServices.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#1565C0]" />
        </div>
      ) : (
        <div className="overflow-x-auto pb-20">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="text-left p-3 font-semibold">ID</th>
                <th className="text-left p-3 font-semibold">Service</th>
                <th className="text-left p-3 font-semibold">Rate / 1k</th>
                <th className="text-left p-3 font-semibold">Min</th>
                <th className="text-left p-3 font-semibold">Max</th>
                <th className="text-left p-3 font-semibold hidden md:table-cell">Avg Time</th>
                <th className="text-left p-3 font-semibold hidden md:table-cell">Description</th>
                <th className="text-left p-3 font-semibold"></th>
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
                  <td className="p-3 hidden md:table-cell text-gray-500">{s.averageTime || "—"}</td>
                  <td className="p-3 hidden md:table-cell text-gray-500 max-w-xs truncate">{s.description || "—"}</td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedCategory(s.category);
                        setSelectedServiceId(s.service);
                        setQuantity(String(s.min));
                        setView("new-order");
                      }}
                      className="bg-[#1565C0] hover:bg-[#0d4f9f] text-white"
                    >
                      Order
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No services found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderNewOrder = () => {
    const categoryServices = selectedCategory ? servicesByCategory[selectedCategory] || [] : [];
    const qty = Number(quantity) || 0;

    return (
      <div className="animate-in fade-in duration-300">
        {renderHeader("New Order", "home")}
        <div className="space-y-4 pb-20">
          <div className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white p-4">
            <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" />
              Boost Order
            </div>
            <p className="text-xs text-white/80 mt-1">Select service and fill the form below</p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Service</label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId} disabled={!selectedCategory}>
              <SelectTrigger className="bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {categoryServices.map((s) => (
                  <SelectItem key={s.service} value={s.service}>
                    {s.name} — ₦{s.pricePer1000Ngn.toLocaleString()} / 1k
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedService && (
            <div className="rounded-xl bg-gray-50 dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="font-mono">{selectedService.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rate per 1,000</span>
                <span className="font-bold">₦{selectedService.pricePer1000Ngn.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Min / Max</span>
                <span>{selectedService.min.toLocaleString()} — {selectedService.max.toLocaleString()}</span>
              </div>
              {selectedService.averageTime && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Average time</span>
                  <span>{selectedService.averageTime}</span>
                </div>
              )}
              {selectedService.description && (
                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500">Description: </span>
                  <span className="text-gray-700 dark:text-gray-300">{selectedService.description}</span>
                </div>
              )}
            </div>
          )}

          {/* Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Link</label>
            <Input
              placeholder="https://instagram.com/username or post link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="h-12 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
            <Input
              type="number"
              min={selectedService?.min || 0}
              max={selectedService?.max || 0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
            />
            {selectedService && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Min: {selectedService.min.toLocaleString()}</span>
                <span>Max: {selectedService.max.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Charge summary */}
          <div className="rounded-xl bg-gray-50 dark:bg-[#101820] border border-gray-200 dark:border-gray-800 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Wallet balance</span>
              <span className="font-medium">₦{Math.max(0, user?.balance || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Quantity</span>
              <span className="font-medium">{qty.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between items-center">
              <span className="font-semibold text-gray-900 dark:text-white">Charge</span>
              <span className="text-xl font-black text-[#1565C0]">₦{totalNgn().toLocaleString()}</span>
            </div>
          </div>

          <Button
            onClick={handlePlaceOrder}
            disabled={loading || !selectedService || !link.trim() || qty < (selectedService?.min || 1)}
            className="w-full h-12 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-bold rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Wallet className="h-4 w-4 mr-2" />
                Submit Order
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
            <span className="text-gray-500">Charge</span>
            <span className="font-bold text-[#1565C0]">₦{lastOrder.priceNgn.toLocaleString()}</span>
          </div>
        </div>
      )}
      <div className="flex gap-3 w-full max-w-xs">
        <Button variant="outline" onClick={() => setView("home")} className="flex-1 h-11 rounded-xl">
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

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-3">
        {ORDER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setOrderTab(tab)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              orderTab === tab
                ? "bg-[#1565C0] text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search orders..."
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
        />
      </div>

      <div className="flex items-center justify-end mb-3">
        <button
          onClick={refreshOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1565C0] text-white text-xs font-semibold disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto pb-20">
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              <th className="text-left p-3 font-semibold">ID</th>
              <th className="text-left p-3 font-semibold">Date</th>
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
                <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>
                <td className="p-3 max-w-[120px] truncate">
                  <button
                    onClick={() => window.open(o.link, "_blank", "noopener,noreferrer")}
                    className="text-[#1565C0] hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{o.link}</span>
                  </button>
                </td>
                <td className="p-3 font-bold">₦{o.priceNgn.toLocaleString()}</td>
                <td className="p-3">{o.startCount ?? "—"}</td>
                <td className="p-3">{o.quantity.toLocaleString()}</td>
                <td className="p-3">{o.serviceName}</td>
                <td className={`p-3 capitalize ${getStatusClass(o.status)}`}>{o.status}</td>
                <td className="p-3">{o.remains ?? "—"}</td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
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
    <div className="animate-in fade-in duration-300">
      {renderHeader("Refunds", "home")}

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-3">
        {REFUND_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setRefundTab(tab)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              refundTab === tab
                ? "bg-[#1565C0] text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto pb-20">
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900">
            <tr>
              <th className="text-left p-3 font-semibold">Order ID</th>
              <th className="text-left p-3 font-semibold">Refunded Amount</th>
              <th className="text-left p-3 font-semibold">Order Status</th>
              <th className="text-left p-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredRefunds.map((o) => (
              <tr key={o._id || o.providerOrderId} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3 font-mono text-xs">{o.providerOrderId || "—"}</td>
                <td className="p-3 font-bold text-green-600">
                  {o.status.toLowerCase() === "partial" ? `Partial refund` : "—"}
                </td>
                <td className={`p-3 capitalize ${getStatusClass(o.status)}`}>{o.status}</td>
                <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {filteredRefunds.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
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
    <div className="fixed inset-0 z-40 bg-gray-50 dark:bg-black flex flex-col pt-[60px] pb-[80px]">
      <div className="flex-1 overflow-y-auto p-4">
        {view === "home" && renderHome()}
        {view === "services" && renderServices()}
        {view === "new-order" && renderNewOrder()}
        {view === "success" && renderSuccess()}
        {view === "my-orders" && renderMyOrders()}
        {view === "refunds" && renderRefunds()}
      </div>
    </div>
  );
}

function getStatusClass(status?: string) {
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
}
