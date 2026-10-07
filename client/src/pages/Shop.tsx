import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch, catalogAPI, purchaseHistoryAPI, catalogCategoriesAPI, warmBackend } from "@/lib/api";
import { Banknote, ChevronDown, History, Copy, Home, Menu, LogIn, FileText, Headphones, MessageCircle, Wallet, Eye, EyeOff, CreditCard, Zap, List, Check, User, Bell, ArrowRightLeft, Send, MoreHorizontal, LogOut, Plus, BadgeCheck, X, ShoppingCart, Minus, LayoutGrid, Moon, Sun, HelpCircle, Gift, Smartphone, Loader2, Phone } from "lucide-react";
import bannerImg from "@/assets/ban.jpg";
import bannerLog1 from "@/assets/bannerlog1.jpg";
import bannerLog2 from "@/assets/bannerlog2.jpg";
import bannerLog3 from "@/assets/bannerlogo3.png";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useTheme } from "@/components/theme-provider";
import logo from "@/assets/pics (2).png";
import BuyNumbers from "@/components/numbers/BuyNumbers";
// Removed demo product assets; shop now shows only database products

interface SerialNumber {
  id: string;
  displayId?: string;
  serial: string;
  url?: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  serialNumbers?: SerialNumber[];
  availableStock?: number;
}

interface PurchaseHistoryItem extends Product {
  purchaseDate: string;
  quantity: number;
  assignedSerials?: string[]; // Array of serial numbers assigned to this purchase
}

// Basic user shape for typing localStorage data. Additional dynamic keys allowed as unknown.
interface User {
  id: string;
  email: string;
  name?: string;
  balance?: number;
  referralCode?: string;
  [key: string]: unknown;
}

const initialProducts: Product[] = [];

const PREFETCH_TTL_MS = 5 * 60 * 1000;

const Shop = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isFirstMount = useRef(true);
  const [user, setUser] = useState<User | null>(null);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isCreatingTopup, setIsCreatingTopup] = useState(false);
  const [isCreatingQuickPay, setIsCreatingQuickPay] = useState(false);
  const [isVerifyingTopup, setIsVerifyingTopup] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showDepositHistory, setShowDepositHistory] = useState(false);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showCustomerCareOptions, setShowCustomerCareOptions] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) {
      return;
    }

    const interval = setInterval(() => {
      api.scrollNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [api]);
  const [processedTransactions, setProcessedTransactions] = useState<Set<string>>(new Set());
  // Track if Ercas redirect has been processed in this session
  const [ercasRedirectProcessed, setErcasRedirectProcessed] = useState(false);
  const [depositHistory, setDepositHistory] = useState<Array<{
    _id?: string;
    amount?: number;
    method?: string;
    status?: string;
    createdAt: string;
    reference?: string;
  }>>([]);
  // Fetch deposit history (payments)
  const loadDepositHistory = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/payments/user/${userId}`);
      setDepositHistory(res as Array<{
        _id?: string;
        amount?: number;
        method?: string;
        status?: string;
        createdAt: string;
        reference?: string;
      }>);
    } catch (e) {
      setDepositHistory([]);
    }
  };

  const loadReferralBonuses = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/referral-bonuses/${userId}`);
      setReferralBonuses(res as Array<{
        _id?: string;
        amount: number;
        type: "referrer" | "buyer";
        buyerEmail?: string;
        referrerEmail?: string;
        purchaseAmount: number;
        createdAt: string;
      }>);
    } catch (e) {
      setReferralBonuses([]);
    }
  };
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [referralBonuses, setReferralBonuses] = useState<Array<{
    _id?: string;
    amount: number;
    type: "referrer" | "buyer";
    buyerEmail?: string;
    referrerEmail?: string;
    purchaseAmount: number;
    createdAt: string;
  }>>([]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loadingProducts, setLoadingProducts] = useState(true);
  // Categories from API
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});

  const [showNotificationModal, setShowNotificationModal] = useState(true);

  // New: Purchase summary dialog state
  const [showPurchaseSummaryDialog, setShowPurchaseSummaryDialog] = useState(false);
  const [descriptionProduct, setDescriptionProduct] = useState<Product | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [selectedAccountIds, setSelectedAccountIds] = useState<Record<string, string[]>>({});
  const [showManualFundsDialog, setShowManualFundsDialog] = useState(false);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [showAddMoneyDialog, setShowAddMoneyDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [showBuyNumbers, setShowBuyNumbers] = useState(false);
  const [numbersProvider, setNumbersProvider] = useState<"bloom" | "daisy">("bloom");
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const BrandedLoader = () => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-black/95 backdrop-blur-md">
      <div className="h-16 w-16 rounded-full border-4 border-[#1565C0]/20 border-t-[#1565C0] animate-spin mb-5" />
      <h2 className="text-xl md:text-2xl font-black text-[#1565C0] dark:text-[#4d9cff] tracking-tight text-center">
        Social Media Marketplace
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Please wait...</p>
    </div>
  );
  const [showQuickPayDetailsDialog, setShowQuickPayDetailsDialog] = useState(false);
  const [quickPayDetails, setQuickPayDetails] = useState<{
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    message?: string;
    paymentReference?: string;
  } | null>(null);
  const [purchaseSummaryData, setPurchaseSummaryData] = useState<{
    product: Product | null;
    quantity: number;
    serials: string[];
    balanceBefore: number;
    balanceAfter: number;
  } | null>(null);

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser");
    if (!currentUser) {
      navigate("/auth");
      return;
    }
    // Safely parse user data to avoid crashing the app if storage is corrupted
    let parsedUser: User | null = null;
    try {
      parsedUser = JSON.parse(currentUser) as User;
    } catch (e) {
      // If parsing fails, reset and send user to auth
      console.error("Invalid currentUser in localStorage; clearing and redirecting", e);
      localStorage.removeItem("currentUser");
      navigate("/auth");
      return;
    }
    setUser(parsedUser);

    // Hydrate from prefetch cache immediately if available, for snappy UI
    let hydratedFromCache = false;
    try {
      const now = Date.now();
      const cachedProds = sessionStorage.getItem("prefetch_products");
      const cachedProdsAt = Number(sessionStorage.getItem("prefetch_products_at") || "0");
      const cachedCats = sessionStorage.getItem("prefetch_categories");
      const cachedCatsAt = Number(sessionStorage.getItem("prefetch_categories_at") || "0");

      if (cachedProds && cachedProdsAt > 0 && (now - cachedProdsAt) < PREFETCH_TTL_MS) {
        const prods = JSON.parse(cachedProds) as Product[];
        setProducts(prods);
        setLoadingProducts(false);
        hydratedFromCache = true;
      } else {
        sessionStorage.removeItem("prefetch_products");
        sessionStorage.removeItem("prefetch_products_at");
      }

      if (cachedCats && cachedCatsAt > 0 && (now - cachedCatsAt) < PREFETCH_TTL_MS) {
        const cats = JSON.parse(cachedCats) as Array<{ name: string }>;
        setCategories(["All", ...cats.map(c => c.name)]);
      } else {
        sessionStorage.removeItem("prefetch_categories");
        sessionStorage.removeItem("prefetch_categories_at");
      }
    } catch {
      // ignore cache errors
    }

    // Warm backend in the background to reduce cold-start delays
    warmBackend().catch(() => {});

    // Load products/categories (parallel) and then purchase history (deferred)
    loadProductsAndHistory(parsedUser.id, { silent: hydratedFromCache });
    loadDepositHistory(parsedUser.id);
    loadReferralBonuses(parsedUser.id);
  }, [navigate]);

  // Periodically refresh user balance from backend (every 10 seconds)
  useEffect(() => {
    if (!user) return;

    const refreshBalance = async () => {
      try {
        const res = await apiFetch(`/api/users/current/${user.id}`);
        const userData = res as { id: string; email: string; name?: string; balance: number };
        
        // Only update if balance has changed
        if (userData.balance !== user.balance) {
          const updatedUser = { ...user, balance: userData.balance };
          setUser(updatedUser);
          localStorage.setItem("currentUser", JSON.stringify(updatedUser));
        }
      } catch (e) {
        // Silently fail - user can still use the app with cached balance
        console.error("Failed to refresh balance:", e);
      }
    };

    // Refresh immediately on mount, then every 10 seconds
    if (isFirstMount.current) {
      refreshBalance();
      isFirstMount.current = false;
    }
    const interval = setInterval(refreshBalance, 10000);

    return () => clearInterval(interval);
  }, [user, ercasRedirectProcessed, processedTransactions]);

  const loadProductsAndHistory = async (userId: string, opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) setLoadingProducts(true);

      // Fetch products and categories in parallel with a softer timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000); // Increased to 30 seconds
      const [catalogProducts, cats] = await Promise.all([
        catalogAPI.getAll({ signal: controller.signal }),
        catalogCategoriesAPI.getAll({ signal: controller.signal }),
      ]);
      clearTimeout(timer);

      setProducts(catalogProducts);
      setCategories(["All", ...cats.map(c => c.name)]);
      setCategoryIcons(Object.fromEntries(cats.map(c => [c.name, c.icon || ""])));

      // Refresh prefetch cache for faster future navigations
      try {
        sessionStorage.setItem("prefetch_products", JSON.stringify(catalogProducts));
        sessionStorage.setItem("prefetch_products_at", String(Date.now()));
        sessionStorage.setItem("prefetch_categories", JSON.stringify(cats));
        sessionStorage.setItem("prefetch_categories_at", String(Date.now()));
      } catch {
        // ignore cache write failures
      }
      
      // Defer purchase history so UI renders fast
      (async () => {
        try {
          const history = await purchaseHistoryAPI.getByUserId(userId);
          setPurchaseHistory(history.map(h => ({
            id: h.productId,
            name: h.name,
            description: h.description,
            price: h.price,
            image: h.image,
            category: h.category,
            quantity: h.quantity,
            assignedSerials: h.assignedSerials,
            purchaseDate: h.purchaseDate.toString()
          })));
        } catch (e) {
          console.error("Failed to load purchase history", e);
        }
      })();
    } catch (error) {
      console.error("Error loading data:", error);
      if (!opts.silent) toast.error("Failed to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleBuyClick = (product: Product) => {
    setSelectedProduct(product);
    setPurchaseQuantity(1);
    setShowBuyDialog(true);
  };

  const handleBuySelectedAccounts = async (product: Product) => {
    if (!user) return;
    const selectedIds = selectedAccountIds[product.id] || [];
    if (selectedIds.length === 0) {
      toast.error("Please select at least one account");
      return;
    }

    const serialsWithUrl = (product.serialNumbers || []).filter(s => selectedIds.includes(s.id) && s.url);
    if (serialsWithUrl.length !== selectedIds.length) {
      toast.error("Selected accounts must have a check link");
      return;
    }

    const totalPrice = product.price * selectedIds.length;
    if (Math.max(0, user.balance || 0) < totalPrice) {
      toast.error("Insufficient balance. Please add funds to your wallet.");
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await purchaseHistoryAPI.completePurchase({
        userId: user.id,
        productId: product.id,
        quantity: selectedIds.length,
        serialIds: selectedIds,
      });

      const updatedUser: User = { ...user, balance: result.newBalance };
      setUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));

      const usersRaw = JSON.parse(localStorage.getItem("users") || "[]") as User[];
      const updatedUsers = usersRaw.map(u => u.id === user.id ? updatedUser : u);
      localStorage.setItem("users", JSON.stringify(updatedUsers));

      const updatedProducts = products.map(p => {
        if (p.id === product.id) {
          return {
            ...p,
            availableStock: typeof result.updatedProduct?.availableStock === "number"
              ? result.updatedProduct.availableStock
              : Math.max(0, (p.availableStock || 0) - selectedIds.length),
            serialNumbers: (p.serialNumbers || []).filter(s => !selectedIds.includes(s.id))
          };
        }
        return p;
      });
      setProducts(updatedProducts);

      // Clear selections for this product
      setSelectedAccountIds(prev => ({ ...prev, [product.id]: [] }));

      const history = await purchaseHistoryAPI.getByUserId(user.id);
      setPurchaseHistory(history.map(h => ({
        id: h.productId,
        name: h.name,
        description: h.description,
        price: h.price,
        image: h.image,
        category: h.category,
        quantity: h.quantity,
        assignedSerials: h.assignedSerials,
        purchaseDate: h.purchaseDate.toString()
      })));
      loadReferralBonuses(user.id);

      setPurchaseSummaryData({
        product,
        quantity: selectedIds.length,
        serials: result.assignedSerials || [],
        balanceBefore: Math.max(0, user.balance || 0),
        balanceAfter: result.newBalance
      });
      setShowPurchaseSummaryDialog(true);
    } catch (error: unknown) {
      console.error("Error buying selected accounts:", error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : error instanceof Error
        ? error.message
        : "Failed to complete purchase. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleCancelPurchase = () => {
    setShowBuyDialog(false);
    setSelectedProduct(null);
    setPurchaseQuantity(1);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !user || isPurchasing) return;

    const totalPrice = selectedProduct.price * purchaseQuantity;
    const balanceBefore = Math.max(0, user.balance || 0);

    if (Math.max(0, user.balance || 0) < totalPrice) {
      toast.error("Insufficient balance. Please add funds to your wallet.");
      setShowBuyDialog(false);
      setSelectedProduct(null);
      setPurchaseQuantity(1);
      return;
    }

    // Set loading state to prevent duplicate purchases
    setIsPurchasing(true);

    try {
      const availableStock = typeof selectedProduct.availableStock === "number"
        ? selectedProduct.availableStock
        : (selectedProduct.serialNumbers || []).filter(s => !s.isUsed).length;
      if (availableStock < purchaseQuantity) {
        toast.error(`Only ${availableStock} units available in stock.`);
        return;
      }

      // Complete purchase via backend (deducts balance, assigns serials, creates history)
      const result = await purchaseHistoryAPI.completePurchase({
        userId: user.id,
        productId: selectedProduct.id,
        quantity: purchaseQuantity,
      });

      // Update local state with new balance from backend
      const updatedUser: User = { ...user, balance: result.newBalance };
      setUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      
      const usersRaw = JSON.parse(localStorage.getItem("users") || "[]") as User[];
      const updatedUsers = usersRaw.map(u => u.id === user.id ? updatedUser : u);
      localStorage.setItem("users", JSON.stringify(updatedUsers));

      const updatedProducts = products.map(p => {
        if (p.id === selectedProduct.id) {
          const assigned = result.assignedSerials || [];
          return {
            ...p,
            availableStock: typeof result.updatedProduct?.availableStock === "number"
              ? result.updatedProduct.availableStock
              : (typeof p.availableStock === "number" ? Math.max(0, p.availableStock - purchaseQuantity) : p.availableStock),
            serialNumbers: (p.serialNumbers || []).filter(s => !assigned.includes(s.serial))
          };
        }
        return p;
      });
      setProducts(updatedProducts);
      
      // Reload purchase history
      const history = await purchaseHistoryAPI.getByUserId(user.id);
      setPurchaseHistory(history.map(h => ({
        id: h.productId,
        name: h.name,
        description: h.description,
        price: h.price,
        image: h.image,
        category: h.category,
        quantity: h.quantity,
        assignedSerials: h.assignedSerials,
        purchaseDate: h.purchaseDate.toString()
      })));
      loadReferralBonuses(user.id);

      // Show purchase summary dialog
      setPurchaseSummaryData({
        product: selectedProduct,
        quantity: purchaseQuantity,
        serials: result.assignedSerials || [],
        balanceBefore,
        balanceAfter: result.newBalance
      });
      setShowPurchaseSummaryDialog(true);

      setShowBuyDialog(false);
      setSelectedProduct(null);
      setPurchaseQuantity(1);
    } catch (error: unknown) {
      console.error("Error processing purchase:", error);
      setIsPurchasing(false);
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error 
        : error instanceof Error 
        ? error.message 
        : "Failed to complete purchase. Please try again.";
      toast.error(errorMessage);
      
      // Refresh user balance from server in case of error
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/users/current/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          const refreshedUser = { ...user, balance: data.balance };
          setUser(refreshedUser);
          localStorage.setItem("currentUser", JSON.stringify(refreshedUser));
        }
      } catch (refreshError) {
        console.error("Error refreshing balance:", refreshError);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleTransfer = async () => {
    if (!user) {
      toast.error("Please sign in to transfer");
      return;
    }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!transferEmail.trim()) {
      toast.error("Please enter recipient email");
      return;
    }
    setTransferLoading(true);
    try {
      const res = await apiFetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: user.id, recipientEmail: transferEmail.trim(), amount }),
      }) as { ok: boolean; newBalance: number; recipientEmail: string };
      if (res.ok) {
        toast.success(`₦${amount.toLocaleString()} sent to ${res.recipientEmail}`);
        setUser((prev) => (prev ? { ...prev, balance: res.newBalance } : prev));
        localStorage.setItem("currentUser", JSON.stringify({ ...user, balance: res.newBalance }));
        setTransferEmail("");
        setTransferAmount("");
        setShowTransferDialog(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setTransferLoading(false);
    }
  };

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Get categories that have products (excluding "All")
  const categoriesWithProducts = categories.filter(cat => cat !== "All" && groupedProducts[cat]?.length > 0);

  // Function to scroll to category section
  const scrollToCategory = (category: string) => {
    if (category === "All") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.getElementById(`category-${category}`);
      if (element) {
        const offset = 100; // Offset for fixed header
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
      }
    }
  };

  const handleAddFunds = () => {
     const amount = parseFloat(addFundsAmount);
     if (isNaN(amount) || amount <= 0) {
       toast.error("Please enter a valid amount");
       return;
     }
     setShowPaymentMethodDialog(true);
  };

  const openAddMoneyDialog = () => {
    setAddFundsAmount("");
    setShowAddMoneyDialog(true);
  };

  const proceedToPaymentMethod = () => {
    const amount = parseFloat(addFundsAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setShowAddMoneyDialog(false);
    setShowPaymentMethodDialog(true);
  };

  const EXCHANGE_RATE = 1500;
  const openConvertDialog = () => setShowConvertDialog(true);

  const scrollToProducts = () => {
    const element = document.getElementById("mobile-products-section");
    if (element) {
      const offset = 120;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
    }
  };

  const getNamePartsFromUser = (name?: string) => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { firstName: "Customer", lastName: "User" };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "User" };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  };

  const handleQuickPay = async () => {
    const amount = parseFloat(addFundsAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!user) return;

    setShowPaymentMethodDialog(false);
    setIsCreatingQuickPay(true);

    try {
      const { firstName, lastName } = getNamePartsFromUser(user.name as string | undefined);
      const res = await apiFetch("/api/payments/pocketfi/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          userId: user.id,
          email: user.email,
          firstName,
          lastName,
        }),
      });

      const data = res as {
        success: boolean;
        accountName?: string;
        accountNumber?: string;
        bankName?: string;
        message?: string;
        paymentReference?: string;
      };

      if (!data.success) {
        toast.error(data.message || "Failed to initialize Quick Pay");
        return;
      }

      setQuickPayDetails(data);
      setShowQuickPayDetailsDialog(true);
      toast.success("Quick Pay details ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start Quick Pay";
      toast.error(msg);
    } finally {
      setIsCreatingQuickPay(false);
    }
  };

  const initiateErcasPayment = async () => {
    const amount = parseFloat(addFundsAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Close method selection if open
    setShowPaymentMethodDialog(false);

    // Show loading state
    setIsCreatingTopup(true);

    try {
      // Create payment session
      const res = await apiFetch("/api/payments/ercas/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "NGN",
          userId: user!.id,
          email: user!.email,
          // Include amount in callback so we can recover if localStorage missing
          callbackUrl: `${window.location.origin}/shop?ercasAmount=${amount}`,
        }),
      });

      const { checkoutUrl, paymentReference, transactionReference } = res as {
        checkoutUrl: string;
        paymentReference: string;
        transactionReference: string | null;
      };

      // Store reference for later verification
      localStorage.setItem("latest_topup", JSON.stringify({
        paymentReference,
        transactionReference: transactionReference || null,
        amount,
        createdAt: Date.now(),
      }));

      // Immediately redirect to payment page (same tab)
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        toast.error("Failed to get payment URL");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start payment";
      toast.error(msg);
      setIsCreatingTopup(false);
    }
  };

  // On return from payment provider, auto-resume verification if we see our reference in URL
  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    let pref = params.get("pref");
    const ercasStatus = params.get("status");
    const ercasTransRef = params.get("transRef");
    const ercasAmountParam = params.get("ercasAmount");

    // Handle Ercas redirect first (status=PAID & transRef present, no pref)
    if (!pref && ercasStatus === "PAID" && ercasTransRef) {
      const handledKey = `ercas_handled_${ercasTransRef}`;
      const processingKey = `ercas_processing_${ercasTransRef}`;

      // If we've already handled this transRef before (even across refreshes), skip and clean URL
      if (sessionStorage.getItem(handledKey) === '1' || processedTransactions.has(ercasTransRef) || ercasRedirectProcessed) {
        console.log("Ercas redirect already handled. Skipping.", ercasTransRef);
        const url = new URL(window.location.href);
        url.searchParams.delete("status");
        url.searchParams.delete("transRef");
        url.searchParams.delete("ercasAmount");
        window.history.replaceState({}, "", url.toString());
        return;
      }

      // Mark as processed for this session
  setErcasRedirectProcessed(true);
  setProcessedTransactions(prev => new Set(prev).add(ercasTransRef));
  // Mark as processing in this browser session (survives refresh)
  sessionStorage.setItem(processingKey, '1');

      (async () => {
        setIsVerifyingTopup(true);
        try {
          const storedRaw = localStorage.getItem("latest_topup");
          let amount: number | undefined = undefined;

          // Get amount from localStorage or URL param
          if (storedRaw) {
            try {
              const parsed = JSON.parse(storedRaw) as { amount?: number };
              amount = parsed.amount;
            } catch { /* ignore */ }
          }
          if ((!amount || amount <= 0) && ercasAmountParam) {
            const parsed = parseFloat(ercasAmountParam);
            if (!isNaN(parsed) && parsed > 0) amount = parsed;
          }

          // Call backend to credit
          const creditRes = await apiFetch("/api/payments/ercas/credit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user!.id,
              email: user!.email,
              transRef: ercasTransRef,
              status: ercasStatus,
              amount
            }),
          });

          const { ok, credited, alreadyProcessed, newBalance, amount: backendAmount, error, message } = creditRes as {
            ok: boolean;
            credited: boolean;
            alreadyProcessed?: boolean;
            newBalance?: number;
            amount?: number;
            error?: string;
            message?: string;
          };

          if (ok && (credited || alreadyProcessed)) {
            const finalAmount = backendAmount ?? amount ?? 0;

            // CRITICAL: Use newBalance from backend directly - it's already the correct final balance
            if (typeof newBalance === 'number') {
              const updatedUser: User = { ...user!, balance: newBalance };
              setUser(updatedUser);
              localStorage.setItem("currentUser", JSON.stringify(updatedUser));

              if (alreadyProcessed) {
                toast.info("Payment already processed.");
              } else {
                toast.success(`₦${finalAmount.toFixed(2)} added to your wallet!`);
              }
            } else {
              toast.error("Balance update failed. Please refresh the page.");
            }

            // Mark handled, clear processing flag and cleanup URL params IMMEDIATELY after processing
            sessionStorage.setItem(handledKey, '1');
            sessionStorage.removeItem(processingKey);
            const url = new URL(window.location.href);
            url.searchParams.delete("status");
            url.searchParams.delete("transRef");
            url.searchParams.delete("ercasAmount");
            window.history.replaceState({}, "", url.toString());
            localStorage.removeItem("latest_topup");
          } else {
            toast.error(error || message || "Failed to process payment");
            // Clear processing flag on failure so user can retry
            sessionStorage.removeItem(processingKey);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Payment processing error";
          toast.error(msg);
        } finally {
          setIsVerifyingTopup(false);
        }
      })();
      return; // Skip Paystack flow
    }
    if (!pref) return;
    // Clean pref if provider appended extra query like '?reference='
    if (pref.includes('?') || pref.includes('&')) {
      pref = pref.split('?')[0].split('&')[0];
    }
    
    // Auto-verify using the paymentReference from URL
    (async () => {
      setIsVerifyingTopup(true);
      try {
        // Prefer gateway transactionReference saved earlier, fallback to paymentReference from URL
        const stored = localStorage.getItem("latest_topup");
        let referenceForVerify = pref;
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as { transactionReference?: string | null; paymentReference?: string };
            if (parsed?.transactionReference) referenceForVerify = parsed.transactionReference;
          } catch {
            // Ignore JSON parse errors
          }
        }
        // Response shape from verification endpoints
        type VerifyResponse = {
          status: string;
          amount: number;
          newBalance?: number;
          alreadyCredited?: boolean;
          paymentFound?: boolean;
          details?: unknown;
        };
        let res: VerifyResponse | undefined;
        try {
          // Primary attempt: path param
          res = await apiFetch(`/api/payments/verify/${encodeURIComponent(referenceForVerify)}`);
        } catch (e) {
          // Fallback: query param style
          res = await apiFetch(`/api/payments/verify?reference=${encodeURIComponent(referenceForVerify)}`);
        }
  if (!res) throw new Error("Empty verification response");
  const { status, amount, newBalance, alreadyCredited, paymentFound, details } = res;

        if (status === "success" || status === "completed") {
          const creditedAmount = amount || 0;
          const balanceToUse = typeof newBalance === 'number'
            ? newBalance
            : (alreadyCredited ? (user?.balance || 0) : (user?.balance || 0) + creditedAmount);
          const updatedUser: User = { ...user!, balance: balanceToUse };
          setUser(updatedUser);
          localStorage.setItem("currentUser", JSON.stringify(updatedUser));
          toast.success(`₦${creditedAmount.toFixed(2)} ${alreadyCredited ? 'verified' : 'added'}${paymentFound === false ? ' (record missing, credited virtually)' : ''}`);
          
          // Clean up
          localStorage.removeItem("latest_topup");
          const url = new URL(window.location.href);
          url.searchParams.delete("pref");
          window.history.replaceState({}, "", url.toString());
        } else if (status === "pending") {
          toast.info("Payment is still processing. Please wait a moment and refresh.");
        } else {
          toast.error(`Payment verification failed${details ? `: ${typeof details === 'string' ? details : JSON.stringify(details)}` : ''}. If amount was deducted, contact support.`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Verification failed";
        toast.error(`Verification error: ${msg}. Please try manual verify if payment succeeded.`);
      } finally {
        setIsVerifyingTopup(false);
      }
    })();
  }, [user, ercasRedirectProcessed, processedTransactions]);

  const handleSignOut = () => {
    localStorage.removeItem("currentUser");
    toast.info("Signed out successfully");
    navigate("/");
  };

  const referralLink = user?.referralCode
    ? `https://socialmediamarketplace.org/auth?ref=${encodeURIComponent(user.referralCode)}`
    : "";

  const copyReferralLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied");
    } catch {
      toast.error("Unable to copy referral link");
    }
  };

  const getSerialDisplayId = (serial: SerialNumber): string => {
    if (serial.displayId) return serial.displayId;
    // Stable numeric fallback derived from the serial UUID
    let hash = 0;
    for (let i = 0; i < serial.id.length; i++) {
      hash = ((hash << 5) - hash) + serial.id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 900000 + 100000).toString();
  };

  const ProductCard = ({ product, index }: { product: Product; index: number }) => {
    const availableStock = typeof product.availableStock === "number"
      ? product.availableStock
      : (product.serialNumbers || []).filter(s => !s.isUsed).length;
    const isOutOfStock = availableStock === 0;
    const accountsExpanded = !!expandedAccounts[product.id];
    const selectedIds = selectedAccountIds[product.id] || [];
    const visibleSerials = (product.serialNumbers || []).filter(s => !s.isUsed && s.url);

    const toggleAccountSelection = (serialId: string) => {
      setSelectedAccountIds(prev => {
        const current = prev[product.id] || [];
        const next = current.includes(serialId)
          ? current.filter(id => id !== serialId)
          : [...current, serialId];
        return { ...prev, [product.id]: next };
      });
    };

    const isPhoneNumber = (value: string) => /^[\+]?[\d\s\-\(\)]{7,}$/.test(value.trim());

    const openSerialUrl = (url: string) => {
      if (!url) return;
      if (isPhoneNumber(url)) {
        window.location.href = `tel:${url.replace(/\s/g, "")}`;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    };

    const copySerialUrl = async (url: string) => {
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(isPhoneNumber(url) ? "Phone number copied" : "Link copied");
      } catch {
        toast.error("Failed to copy");
      }
    };

    return (
      <>
        <Card
          key={product.id}
          className="bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/40 dark:via-gray-900 dark:to-blue-950/40 shadow-lg border border-purple-100/60 dark:border-purple-800/30 mx-2 md:mx-0 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom group"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardContent className="p-0">
            {/* Mobile Layout */}
            <div className="flex flex-col p-4 md:hidden gap-3">
              <div className="flex items-start gap-3">
                <div className="relative overflow-hidden rounded-xl flex-shrink-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-xl"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base leading-tight text-gray-900 dark:text-gray-100 break-words">
                    {product.name}
                  </h3>
                </div>
              </div>

              <div className="text-2xl font-black text-gray-900 dark:text-white">
                ₦{product.price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDescriptionProduct(product)}
                  className="rounded-full border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 h-9 px-3"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  Description
                </Button>
                <span className={`text-sm font-semibold ${isOutOfStock ? "text-red-500" : "text-[#FFC107]"}`}>
                  {isOutOfStock ? "0 in stock" : `${availableStock} in stock`}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedAccounts(prev => ({ ...prev, [product.id]: !prev[product.id] }))}
                className="rounded-full border-amber-500 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 h-10 w-full"
              >
                <List className="h-4 w-4 mr-2" />
                View Accounts ({availableStock})
              </Button>

              <Button
                onClick={() => handleBuyClick(product)}
                disabled={isOutOfStock}
                className={`h-11 w-full rounded-full text-white font-bold shadow-md ${
                  isOutOfStock
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                }`}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {isOutOfStock ? "Out of Stock" : "Buy Now"}
              </Button>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex md:items-center gap-4 md:p-4 min-w-0">
              {/* Small Product Image */}
              <div className="relative overflow-hidden rounded-lg flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-[#4d9cff]/0 to-[#4d9cff]/0 group-hover:from-[#4d9cff]/20 group-hover:to-[#4d9cff]/20 transition-all duration-300 z-10"></div>
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-0.5 md:mb-1">
                  <Badge variant="outline" className="px-1.5 md:px-2 py-0.5 text-xs tracking-wide bg-gradient-to-r from-[#d5e5ff] to-[#d5e5ff] text-[#0d4f9f] border-none flex-shrink-0 dark:from-[#0B0F14] dark:to-[#0B0F14] dark:text-[#4d9cff]">
                    {product.category}
                  </Badge>
                  {availableStock > 0 && (
                    <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c]">
                      {availableStock} in stock
                    </Badge>
                  )}
                  {isOutOfStock && (
                    <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                      Out of stock
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-sm md:text-base lg:text-lg mb-0.5 md:mb-1 bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c] dark:from-[#4d9cff] dark:to-[#1565C0] whitespace-normal break-words leading-tight md:truncate flex-1 min-w-0">
                  {product.name}
                </h3>
              </div>

              {/* Desktop Layout: Description, Price, Button */}
              <div className="hidden md:flex md:items-center md:gap-4 md:flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-5 flex-1">{product.description}</p>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]">
                      ₦{product.price.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleBuyClick(product)}
                    disabled={isOutOfStock}
                    className={`h-9 px-4 ${isOutOfStock ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1565C0] hover:bg-[#0d4f9f]'} text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg text-sm`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Purchase Section (mobile only, shown below product card) */}
        {accountsExpanded && (
          <div className="md:hidden mx-2 mt-3 mb-6 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/40 dark:via-gray-900 dark:to-blue-950/40 rounded-2xl border border-purple-100/60 dark:border-purple-800/30 p-4 shadow-md animate-in fade-in slide-in-from-top duration-200">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">Bulk Purchase</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Select accounts and buy multiple at once
            </p>
            <Button
              onClick={() => handleBuySelectedAccounts(product)}
              disabled={selectedIds.length === 0 || isPurchasing}
              className="w-full h-11 rounded-full bg-[#0B0F14] dark:bg-[#1565C0] hover:bg-gray-800 dark:hover:bg-[#0d4f9f] text-white font-bold mb-2"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Buy Selected Accounts
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {selectedIds.length} account{selectedIds.length === 1 ? "" : "s"} selected
            </p>

            <div className="space-y-2">
              {visibleSerials.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No checkable accounts available</p>
              ) : (
                visibleSerials.map(serial => {
                  const displayId = getSerialDisplayId(serial);
                  const isSelected = selectedIds.includes(serial.id);
                  return (
                    <div
                      key={serial.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#09090b]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAccountSelection(serial.id)}
                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-[#1565C0] border-[#1565C0] text-white"
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-black"
                        }`}
                        aria-label={isSelected ? "Deselect account" : "Select account"}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                          {serial.url && isPhoneNumber(serial.url) ? "Phone Number" : "Account"}
                        </p>
                        <p className="font-bold text-sm text-[#1565C0] dark:text-[#4d9cff]">#{displayId}</p>
                        {serial.url && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {isPhoneNumber(serial.url) ? serial.url : "Check link available"}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openSerialUrl(serial.url || "")}
                        disabled={!serial.url}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40"
                        aria-label={serial.url && isPhoneNumber(serial.url) ? "Call phone number" : "Open link"}
                      >
                        {serial.url && isPhoneNumber(serial.url) ? <Phone className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copySerialUrl(serial.url || "")}
                        disabled={!serial.url}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-40"
                        aria-label={serial.url && isPhoneNumber(serial.url) ? "Copy phone number" : "Copy link"}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black relative pb-20 transition-colors duration-300">
      {/* Animated gradient orbs */}
      {/* <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#4d9cff]/20 to-[#4d9cff]/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#4d9cff]/20 to-[#4d9cff]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-[#4d9cff]/15 to-[#4d9cff]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div> */}
      
      {/* Desktop Navbar - hidden on mobile */}
      <div className="hidden md:block">
        <Navbar 
          isShopPage 
          cartItemCount={purchaseHistory.length} 
          onCartClick={() => setShowPurchaseHistory(true)}
          onMenuClick={() => setShowCategoryDrawer(true)}
          onGeneralMenuClick={() => setShowMenuDrawer(true)}
          shopCategories={categories}
          onShopCategorySelect={(category) => {
            setActiveCategory(category);
            scrollToCategory(category);
          }}
          onShopBalanceClick={() => setShowBalanceModal(true)}
          onShopPurchaseHistoryClick={() => setShowPurchaseHistory(true)}
          onShopDepositHistoryClick={() => setShowDepositHistory(true)}
          onShopSignOutClick={handleSignOut}
        />
      </div>

      {/* Branded Loading Overlay */}
      {(loadingProducts || isCreatingQuickPay) && <BrandedLoader />}

      {/* Buy Numbers Page */}
      {showBuyNumbers && user && (
        <BuyNumbers
          user={user}
          provider={numbersProvider}
          onClose={() => setShowBuyNumbers(false)}
          onBalanceChange={(balance) => {
            setUser((prev) => (prev ? { ...prev, balance } : prev));
            localStorage.setItem("currentUser", JSON.stringify({ ...user, balance }));
          }}
        />
      )}

      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-50 bg-gray-50/95 dark:bg-black/95 backdrop-blur-md px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <button 
            onClick={() => setShowCategoryDrawer(true)} 
            className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            aria-label="Open categories"
          >
            <Menu className="h-6 w-6 text-gray-700 dark:text-gray-200" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Social Media Marketplace" className="h-8 w-auto max-w-[140px] object-contain" />
            <span className="text-sm font-black tracking-tight text-[#1565C0] dark:text-[#4d9cff]">SMMP</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowBalanceModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold"
            >
              <Wallet className="h-3.5 w-3.5" />
              ₦{Math.max(0, user.balance || 0).toFixed(0)}
            </button>
            <button 
              onClick={() => setShowNotificationsDrawer(true)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-gray-700 dark:text-gray-200" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button 
              onClick={() => setShowMenuDrawer(true)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open menu"
            >
              <User className="h-5 w-5 text-gray-700 dark:text-gray-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Modal */}
      <Dialog open={showNotificationModal} onOpenChange={setShowNotificationModal}>
        <DialogContent className="sm:max-w-md w-[90vw] md:w-full bg-white dark:bg-black p-4 sm:p-6 rounded-2xl border-2 border-white/60 dark:border-gray-800">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0a3d7c] dark:from-[#4d9cff] dark:to-[#1565C0] text-center">
              New Update
            </DialogTitle>
            <DialogDescription className="hidden">Notification about the new Telegram channel</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
            <div className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed px-1 sm:px-2 space-y-3 text-left">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Join Our New Channel</p>
                <p>Kindly use the link below to join our new channel for updates, announcements, and important information. If you need any assistance, please contact our Support Team.</p>
              </div>
              <div>
                <p className="font-bold text-[#1565C0] dark:text-[#4d9cff]">Refer & Earn ₦300!</p>
                <p>Invite your friends and earn ₦300 for every successful referral. The person you refer will also receive ₦200 when they make a ₦3,000 product purchase.</p>
              </div>
              <p className="font-medium">👉 Join now, refer your friends, and start earning!</p>
            </div>
            
            <div className="w-full flex justify-center py-2">
              <Button 
                onClick={() => window.open("https://t.me/officialsocialmediamarketplace", "_blank")}
                className="w-full sm:w-3/4 flex items-center justify-center gap-2 bg-[#0088cc] hover:bg-[#0077b3] text-white"
              >
                <Send className="w-4 h-4" />
                Join New Channel
              </Button>
            </div>

            <div className="w-full flex justify-center pb-2">
              <Button 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText("https://t.me/officialsocialmediamarketplace");
                  toast.success("Link copied!");
                }}
                className="w-full sm:w-3/4 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </Button>
            </div>

            <Button 
              variant="secondary"
              onClick={() => setShowNotificationModal(false)}
              className="w-full sm:w-3/4 font-semibold mt-2 border border-gray-200 dark:border-gray-800"
            >
              Got it, thanks!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Description Dialog */}
      <Dialog open={!!descriptionProduct} onOpenChange={(open) => { if (!open) setDescriptionProduct(null); }}>
        <DialogContent className="sm:max-w-md w-[90vw] md:w-full bg-white dark:bg-black rounded-2xl border-2 border-white/60 dark:border-gray-800 p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <img
                src={descriptionProduct?.image}
                alt={descriptionProduct?.name}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                  {descriptionProduct?.name}
                </DialogTitle>
                <p className="text-sm text-[#1565C0] dark:text-[#4d9cff] font-semibold mt-0.5">
                  ₦{descriptionProduct?.price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {descriptionProduct?.description}
            </p>
          </div>
          <DialogFooter className="p-4 pt-0">
            <Button
              variant="outline"
              onClick={() => setDescriptionProduct(null)}
              className="w-full rounded-full border-gray-300 dark:border-gray-700"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Summary Dialog */}
      <Dialog open={showPurchaseSummaryDialog} onOpenChange={setShowPurchaseSummaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-green-600" />
              Purchase Successful
            </DialogTitle>
            <DialogDescription>
              Your order has been completed. Below is your transaction summary and serial number(s).
            </DialogDescription>
          </DialogHeader>
          {purchaseSummaryData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src={purchaseSummaryData.product?.image} alt={purchaseSummaryData.product?.name} className="w-16 h-16 rounded-lg object-contain border" />
                <div>
                  <div className="font-bold text-lg">{purchaseSummaryData.product?.name}</div>
                  <div className="text-sm text-gray-500">{purchaseSummaryData.product?.category}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-semibold text-gray-700">Wallet Before:</div>
                <div className="text-gray-800">₦{purchaseSummaryData.balanceBefore.toFixed(2)}</div>
                <div className="font-semibold text-gray-700">Wallet After:</div>
                <div className="text-gray-800">₦{purchaseSummaryData.balanceAfter.toFixed(2)}</div>
                <div className="font-semibold text-gray-700">Quantity:</div>
                <div className="text-gray-800">{purchaseSummaryData.quantity}</div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-700">Log:</div>
                  {purchaseSummaryData.serials.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const allSerials = purchaseSummaryData.serials.join('\n');
                        navigator.clipboard.writeText(allSerials);
                        toast.success(`${purchaseSummaryData.serials.length} logs copied!`);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy All Logs
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {purchaseSummaryData.serials.map((serial, idx) => (
                    <div key={serial} className="flex items-start gap-2 bg-gray-100 rounded px-2 py-2">
                      <span className="font-mono text-sm text-[#0d4f9f] break-all whitespace-pre-wrap leading-relaxed flex-1">{serial}</span>
                      <button
                        type="button"
                        className="ml-2 text-[#1565C0] hover:text-[#0a3d7c] flex-shrink-0 mt-1"
                        onClick={() => {
                          navigator.clipboard.writeText(serial);
                          toast.success('Serial copied!');
                        }}
                        aria-label="Copy serial"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8m-8-4h8M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseSummaryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pt-4 md:pt-24 relative">
        {/* Desktop Banner Section */}
        <div className="relative mb-6 animate-in fade-in slide-in-from-top duration-500 hidden md:block">
          <h1 className="mt-2 md:mt-6 text-center text-3xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0] tracking-tight">
            Shop Correct LOGs
          </h1>

          <div className="flex justify-center mt-2 md:mt-4">
            <div className="flex items-center gap-1 md:gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-xl px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
              <span className="text-[10px] md:text-sm text-gray-600 dark:text-gray-400 font-semibold">Welcome</span>
              <span className="text-xs md:text-base text-gray-700 dark:text-gray-300 font-medium">
                {user.name || user.email.split('@')[0]}
              </span>
              <BadgeCheck className="h-3 w-3 md:h-5 md:w-5 text-[#1565C0]" />
            </div>
          </div>
        </div>

        <div className="px-0 md:px-6">
          <div className="container mx-auto px-0 md:px-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <main className="flex-1 min-w-0 w-full">

            {/* Mobile Greeting + Wallet + Quick Actions */}
            <div className="md:hidden px-4 mb-6 animate-in fade-in slide-in-from-top duration-500">
              <div className="mb-4">
                <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  Hello {user.name || user.email.split('@')[0]} <span className="text-2xl">👋</span>
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Here's an overview of your account's recent activity.
                </p>
              </div>

              {/* Purple Wallet Card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#4c1d95] p-5 text-white shadow-xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-10 -mb-10 blur-2xl"></div>

                <div className="relative flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wider">
                    <Wallet className="h-4 w-4" />
                    Wallet Balance
                  </div>
                  <button
                    onClick={() => setShowBalance(!showBalance)}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label={showBalance ? "Hide balance" : "Show balance"}
                  >
                    {showBalance ? <EyeOff className="h-4 w-4 text-white/80" /> : <Eye className="h-4 w-4 text-white/80" />}
                  </button>
                </div>

                <div className="relative mb-3">
                  <div className="text-4xl font-black tracking-tight">
                    {showBalance ? `₦${Math.max(0, user.balance || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
                  </div>
                </div>

                <div className="relative flex items-center justify-between">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
                    USD ${(Math.max(0, user.balance || 0) / 1500).toFixed(2)}
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-white/90">
                    <User className="h-4 w-4" />
                    {(user.name || user.email.split('@')[0]).toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 grid grid-cols-5 gap-2">
                <button
                  onClick={openAddMoneyDialog}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center text-white shadow-lg">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">Add money</span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 -mt-1">Fund</span>
                </button>

                <button
                  onClick={() => { setNumbersProvider("bloom"); setShowBuyNumbers(true); }}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">Buy Numbers</span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 -mt-1">Intl</span>
                </button>

                <button
                  onClick={() => { setNumbersProvider("daisy"); setShowBuyNumbers(true); }}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-white shadow-lg">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">Buy USA</span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 -mt-1">Numbers</span>
                </button>

                <button
                  onClick={openConvertDialog}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white shadow-lg">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">Convert</span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 -mt-1">Exchange</span>
                </button>

                <button
                  onClick={() => setShowTransferDialog(true)}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg">
                    <Send className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-800 dark:text-gray-200">Send</span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 -mt-1">Transfer</span>
                </button>
              </div>
            </div>

            {/* Desktop/tablet wallet card (hidden on small screens) */}
            <Card className="hidden md:block mb-6 overflow-hidden rounded-2xl border border-[#1565C0]/20 bg-white shadow-xl dark:border-white/10 dark:bg-[#101820] md:mb-8 animate-in fade-in slide-in-from-left duration-700">
              <CardHeader className="pb-3 md:pb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex w-full items-center gap-4 rounded-2xl bg-[#0B0F14] p-6 shadow-lg">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/30">
                      <Wallet className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-3"><img src={logo} alt="Social Media Marketplace" className="h-7 w-auto max-w-[180px] object-contain" /><span className="text-xs font-bold uppercase tracking-wider text-[#FFC107]">social media market place</span></div>
                      <div className="mb-3 overflow-hidden whitespace-nowrap text-xs font-semibold text-[#FFC107]"><div className="marquee-track inline-flex gap-8">we have sold 1.8 million accounts and still counting, join us today · our services are quick, reliable and affordable · we have sold 1.8 million accounts and still counting</div></div>
                      <CardTitle className="text-2xl font-bold text-white mb-1">Available Balance</CardTitle>
                      <CardDescription className="text-lg font-medium text-[#d5e5ff] flex items-center">
                        <span className="text-white font-black text-4xl tracking-tight ml-0">
                          {showBalance ? `₦${Math.max(0, user.balance || 0).toFixed(2)}` : '••••••'}
                        </span>
                        <button 
                          onClick={() => setShowBalance(!showBalance)} 
                          className="ml-3 p-1.5 hover:bg-white/10 rounded-full transition-colors"
                          aria-label={showBalance ? "Hide balance" : "Show balance"}
                        >
                          {showBalance ? <EyeOff className="h-5 w-5 text-[#d5e5ff]" /> : <Eye className="h-5 w-5 text-[#d5e5ff]" />}
                        </button>
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    className="h-10 md:h-12 border-2 border-gray-200 dark:border-gray-700 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 text-sm md:text-base"
                  />
                  <Button 
                    onClick={handleAddFunds}
                    className="h-10 md:h-12 px-4 md:px-6 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl text-sm md:text-base w-full sm:w-auto"
                  >
                    <Plus className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                    Add Funds
                  </Button>
                </div>
                <p className="mt-5 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-500 dark:border-white/10 dark:text-white/60">{user.name || user.email.split("@")[0]}</p>
              </CardContent>
            </Card>
            {/* Products and Buy Dialog */}
            <div id="mobile-products-section" className="grid lg:grid-cols-1 gap-8 scroll-mt-32">
              {/* Products Grid */}
              <div className="lg:col-span-1">


                {/* Display products grouped by category */}
                {activeCategory === "All" ? (
                  // Show all categories with headings
                  <div className="space-y-8 md:space-y-12">
                    {categoriesWithProducts.map((category) => {
                      const categoryProducts = groupedProducts[category] || [];
                      const displayedProducts = categoryProducts;

                      return (
                      <div key={category} id={`category-${category}`} className="scroll-mt-24">
                        <div className="flex items-center justify-between mb-4 md:mb-6 px-4 md:px-0">
                          <h3 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0] border-b-2 border-gray-200 dark:border-gray-800 pb-2 flex-1">
                            {category}
                          </h3>
                          {/* 'See More' button removed as requested */}
                        </div>
                        <div className="space-y-3 md:space-y-4">
                          {displayedProducts.map((product, index) => (
                            <ProductCard key={product.id} product={product} index={index} />
                          ))}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  // Show single category
                  <div id={`category-${activeCategory}`} className="scroll-mt-24">
                    {(() => {
                      const categoryProducts = groupedProducts[activeCategory] || [];
                      const displayedProducts = categoryProducts;

                      return (
                        <>
                          <div className="flex items-center justify-between mb-4 md:mb-6 px-4 md:px-0">
                            <h3 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0] border-b-2 border-gray-200 dark:border-gray-800 pb-2 flex-1">
                              {activeCategory}
                            </h3>
                            {/* 'See More' button removed as requested */}
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            {displayedProducts.map((product, index) => (
                              <ProductCard key={product.id} product={product} index={index} />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </main>
          
          {/* Right Sidebar - Desktop Only */}
          <aside className="hidden md:block w-64 flex-shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto bg-white/50 dark:bg-black/50 backdrop-blur-xl rounded-xl border border-gray-200 dark:border-gray-800 p-4">
             <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 px-2">Menu</h2>
             <div className="space-y-2">
              <button
                onClick={() => window.open('https://drive.google.com/drive/folders/10zf4evrldtQlb6L5NkPMwTSOs1WW3y7d', '_blank')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#18181b] rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                  <LogIn className="h-4 w-4 text-[#1565C0] dark:text-[#4d9cff]" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">How to Login</div>
                </div>
              </button>
              
              <button
                onClick={() => setShowBalanceModal(true)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#18181b] rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-[#1565C0] dark:text-[#4d9cff]" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">Balance</div>
                </div>
              </button>
              
              <button
                onClick={() => navigate('/rules')}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#18181b] rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">Rules</div>
                </div>
              </button>
              
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Support</div>
                <button
                    onClick={() => window.open('https://chat.whatsapp.com/G3mMW8GxSg15yNRzNQ3f84', '_blank')}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#18181b] rounded-lg transition-colors mt-1"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm text-gray-800 dark:text-gray-200">WhatsApp</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => window.open('https://t.me/officialsocialmediamarketplace', '_blank')}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#18181b] rounded-lg transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-[#1565C0] dark:text-[#4d9cff]" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm text-gray-800 dark:text-gray-200">Telegram</div>
                    </div>
                  </button>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm text-gray-800 dark:text-gray-200">Sign Out</div>
                </div>
              </button>
              </div>
             </div>
          </aside>
        </div>
      </div>
    </div>
      {/* Floating Customer Help (mobile only, above bottom nav) */}
      <div className="md:hidden fixed bottom-24 right-5 z-40">
        <a
          href="https://t.me/officialsocialmediamarketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 group"
          aria-label="Customer help"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-full shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-all duration-300">
            <HelpCircle className="h-6 w-6" />
          </div>
        </a>
      </div>
      </div>

      {/* Buy Confirmation Dialog */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-black/95 backdrop-blur-xl border-2 border-white/60 dark:border-gray-800 p-3 md:p-4">
          <DialogHeader className="pb-1 md:pb-2">
            <DialogTitle className="text-lg md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]">
              Confirm Purchase
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Review the product details below before completing your purchase.
            </DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-2 md:space-y-3 py-1 md:py-2">
              {/* Product Image */}
              <div className="flex justify-center">
                <div className="relative overflow-hidden rounded-xl shadow-md">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-20 h-20 md:w-28 md:h-28 object-cover rounded-xl"
                  />
                </div>
              </div>
              
              {/* Product Details */}
              <div className="space-y-2 md:space-y-2">
                <div>
                  <h3 className="text-base md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {selectedProduct.name}
                  </h3>
                  <Badge variant="outline" className="text-xs bg-gradient-to-r from-[#d5e5ff] to-[#d5e5ff] dark:from-[#0B0F14] dark:to-[#0B0F14] text-[#0d4f9f] dark:text-[#4d9cff] border-none">
                    {selectedProduct.category}
                  </Badge>
                </div>
                
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {selectedProduct.description}
                </p>
                
                <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-800">
                  <span className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300">Unit Price:</span>
                  <Badge className="text-sm md:text-lg px-3 md:px-4 py-1 md:py-2 bg-gradient-to-r from-[#1565C0] to-[#4d9cff] font-bold">
                    ₦{selectedProduct.price}
                  </Badge>
                </div>

                {/* Quantity Selector */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300">Quantity:</span>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                      disabled={purchaseQuantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-bold min-w-[2rem] text-center">{purchaseQuantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        const maxStock = typeof selectedProduct.availableStock === "number"
                          ? selectedProduct.availableStock
                          : (selectedProduct.serialNumbers || []).filter(s => !s.isUsed).length;
                        setPurchaseQuantity(Math.min(maxStock, purchaseQuantity + 1));
                      }}
                      disabled={purchaseQuantity >= (typeof selectedProduct.availableStock === "number"
                        ? selectedProduct.availableStock
                        : (selectedProduct.serialNumbers || []).filter(s => !s.isUsed).length)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                  {(typeof selectedProduct.availableStock === "number"
                    ? selectedProduct.availableStock
                    : (selectedProduct.serialNumbers || []).filter(s => !s.isUsed).length)} units available
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-800">
                  <span className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300">Total:</span>
                  <Badge className="text-sm md:text-lg px-3 md:px-4 py-1 md:py-2 bg-gradient-to-r from-[#1565C0] to-[#1565C0] font-bold">
                    ₦{(selectedProduct.price * purchaseQuantity).toFixed(2)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Your Balance:</span>
                  <span className="text-xs md:text-sm font-bold text-[#1565C0] dark:text-[#4d9cff]">
                    ₦{Math.max(0, user?.balance || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Confirmation Message */}
              <div className="bg-[#e8f1ff] dark:bg-[#0B0F14]/30 p-2 md:p-3 rounded-lg border border-[#b0cdf5] dark:border-[#0B0F14]">
                <p className="text-center text-xs md:text-sm font-medium text-[#0B0F14] dark:text-[#8fb5e8]">
                  Do you want to pay for {purchaseQuantity} {purchaseQuantity === 1 ? 'item' : 'items'}?
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-row gap-2 md:gap-3 pt-2 md:pt-3 sticky bottom-0 bg-white/95 dark:bg-black/95 -mx-3 md:-mx-4 px-3 md:px-4 pb-0">
            <Button
              variant="outline"
              onClick={handleCancelPurchase}
              className="flex-1 h-10 md:h-11 text-sm md:text-base border-2 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#18181b] font-semibold"
            >
              <X className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={isPurchasing || Math.max(0, user?.balance || 0) < (selectedProduct?.price || 0) * purchaseQuantity}
              className="flex-1 h-10 md:h-11 text-sm md:text-base bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPurchasing ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <span className="mr-1 md:mr-2">₦</span>
                  {Math.max(0, user?.balance || 0) >= (selectedProduct?.price || 0) * purchaseQuantity ? "Continue" : "Insufficient Balance"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase History Dialog */}
      <Dialog open={showPurchaseHistory} onOpenChange={setShowPurchaseHistory}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto bg-white/95 dark:bg-black/95 backdrop-blur-xl border-2 border-white/60 dark:border-gray-800 p-4 md:p-6">
          <DialogHeader className="pb-3 md:pb-4">
            <DialogTitle className="text-lg md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0] flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
              Purchase History
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              View all your purchased items
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {purchaseHistory.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No purchases yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your purchased items will appear here</p>
              </div>
            ) : (
              purchaseHistory.map((item, index) => (
                <Card key={index} className="bg-white/80 dark:bg-[#09090b]/80 border border-gray-200 dark:border-gray-700">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Product Image */}
                      <div className="relative overflow-hidden rounded-lg flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      </div>
                      
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 mb-1">
                          <div className="min-w-0 flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                            <h4 className="font-semibold text-xs md:text-sm text-gray-900 dark:text-gray-100 truncate line-clamp-1 flex-1 min-w-0">
                              {item.name}
                            </h4>
                            {item.quantity > 1 && (
                              <Badge className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-[#09090b] text-gray-700 dark:text-gray-300 whitespace-nowrap flex-shrink-0">
                                x{item.quantity}
                              </Badge>
                            )}
                          </div>
                          <Badge className="text-xs px-2 py-0.5 bg-gradient-to-r from-[#1565C0] to-[#4d9cff] font-bold whitespace-nowrap flex-shrink-0 mt-1 md:mt-0">
                            ₦{(item.price * item.quantity).toFixed(2)}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-gradient-to-r from-[#d5e5ff] to-[#d5e5ff] dark:from-[#0B0F14] dark:to-[#0B0F14] text-[#0d4f9f] dark:text-[#4d9cff] border-none mb-1">
                          {item.category}
                        </Badge>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                          {item.description}
                        </p>
                        
                        {/* Serial Numbers */}
                        {item.assignedSerials && item.assignedSerials.length > 0 && (
                          <div className="mt-2 p-2 bg-[#e8f1ff] dark:bg-[#0B0F14]/30 rounded-lg border border-[#b0cdf5] dark:border-[#0a3d7c]">
                            <p className="text-xs font-semibold text-[#0B0F14] dark:text-[#8fb5e8] mb-1">
                              Logs:
                            </p>
                            <div className="space-y-1">
                              {item.assignedSerials.map((serial, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <Badge className="text-xs font-mono bg-[#1565C0] hover:bg-[#0d4f9f] px-2 py-2 flex-1 break-all whitespace-pre-wrap leading-relaxed text-left h-auto">
                                    {serial}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-[#d5e5ff] dark:hover:bg-[#0B0F14] flex-shrink-0 mt-1"
                                    onClick={() => {
                                      navigator.clipboard.writeText(serial);
                                      toast.success('Serial number copied!');
                                    }}
                                  >
                                    <Copy className="h-3 w-3 text-[#1565C0] dark:text-[#4d9cff]" />
                                  </Button>
                                  {item.assignedSerials!.length > 1 && (
                                    <span className="text-[10px] text-gray-500">Unit {idx + 1}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          Purchased: {new Date(item.purchaseDate).toLocaleDateString()} at {new Date(item.purchaseDate).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          
          <DialogFooter className="pt-3 md:pt-4 sticky bottom-0 bg-white/95 dark:bg-black/95 -mx-4 md:-mx-6 px-4 md:px-6 pb-0">
            <Button
              onClick={() => setShowPurchaseHistory(false)}
              className="w-full h-10 md:h-11 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit History Modal */}
      {showDepositHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-black rounded-xl shadow-2xl w-full max-w-md mx-auto overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/50">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#1565C0]" /> 
                Deposit History
              </h2>
              <button 
                onClick={() => setShowDepositHistory(false)} 
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#18181b] transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {depositHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-[#09090b] rounded-full flex items-center justify-center mb-3">
                    <History className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No deposits found</p>
                  <p className="text-xs text-gray-400 mt-1">Your deposit history will appear here</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {depositHistory.map((d, i) => (
                    <li key={d._id || i} className="p-3 rounded-lg bg-gray-50 dark:bg-[#09090b]/50 border border-gray-100 dark:border-gray-800 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1565C0] dark:text-[#4d9cff] text-lg">₦{d.amount?.toFixed(2)}</span>
                        <Badge variant={d.status === 'success' || d.status === 'completed' ? 'default' : 'secondary'} className={d.status === 'success' || d.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''}>
                          {d.status?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>{d.method?.toUpperCase()}</span>
                        <span>{new Date(d.createdAt).toLocaleDateString()} {new Date(d.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {d.reference && (
                        <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-[10px] text-gray-400 font-mono">Ref: {d.reference}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/50">
              <Button onClick={() => setShowDepositHistory(false)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category Drawer */}
      {showCategoryDrawer && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setShowCategoryDrawer(false)}
          />
          
          {/* Drawer */}
          <div className={`fixed top-0 left-0 h-[100dvh] w-80 max-w-[85vw] bg-white dark:bg-black shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
            showCategoryDrawer ? 'translate-x-0' : '-translate-x-full'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Categories</h2>
              <button
                onClick={() => setShowCategoryDrawer(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Categories List */}
            <div className="flex-1 overflow-y-auto py-4 pb-20">
              {categories.map((category) => {
                const isActive = activeCategory === category;
                const categoryProducts = category === "All" 
                  ? products 
                  : products.filter(p => p.category === category);
                const productCount = categoryProducts.length;
                
                // Choose appropriate icon for each category
                const getCategoryIcon = (cat: string) => {
                  if (categoryIcons[cat]) {
                    return <img src={categoryIcons[cat]} alt="" className="h-5 w-5 object-contain" />;
                  }
                  switch (cat.toLowerCase()) {
                    case 'all':
                      return <Menu className="h-5 w-5" />;
                    case 'social media':
                    case 'instagram':
                    case 'facebook':
                    case 'twitter':
                    case 'tiktok':
                      return <div className="h-5 w-5 rounded-full bg-gradient-to-r from-[#1565C0] to-[#1565C0] flex items-center justify-center text-white text-xs font-bold">S</div>;
                    case 'gaming':
                      return <div className="h-5 w-5 rounded-full bg-gradient-to-r from-green-500 to-[#1565C0] flex items-center justify-center text-white text-xs font-bold">G</div>;
                    case 'music':
                    case 'spotify':
                      return <div className="h-5 w-5 rounded-full bg-gradient-to-r from-red-500 to-yellow-500 flex items-center justify-center text-white text-xs font-bold">M</div>;
                    case 'business':
                    case 'professional':
                      return <div className="h-5 w-5 rounded-full bg-gradient-to-r from-[#1565C0] to-[#1565C0] flex items-center justify-center text-white text-xs font-bold">B</div>;
                    default:
                      return <div className="h-5 w-5 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center text-white text-xs font-bold">C</div>;
                  }
                };
                
                return (
                  <button
                    key={category}
                    onClick={() => {
                      setActiveCategory(category);
                      scrollToCategory(category);
                      setShowCategoryDrawer(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors ${
                      isActive ? 'bg-[#d5e5ff] dark:bg-[#0B0F14] border-r-4 border-[#1565C0]' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 ${isActive ? 'text-[#1565C0]' : 'text-gray-600 dark:text-gray-400'}`}>
                      {getCategoryIcon(category)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${isActive ? 'text-[#1565C0]' : 'text-gray-800 dark:text-gray-200'}`}>
                        {category}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {productCount} {productCount === 1 ? 'product' : 'products'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* General Menu Drawer (Right Side) */}
      {showMenuDrawer && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setShowMenuDrawer(false)}
          />
          
          {/* Drawer */}
          <div className={`fixed top-0 right-0 h-[100dvh] w-80 max-w-[85vw] bg-white dark:bg-black shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
            showMenuDrawer ? 'translate-x-0' : 'translate-x-full'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Menu</h2>
              <button
                onClick={() => setShowMenuDrawer(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            
            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-4 pb-20">
              <div className="mx-4 mb-4 rounded-xl border border-[#1565C0]/25 bg-[#f7f9fc] p-3 dark:border-white/10 dark:bg-[#101820]">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1565C0]">Your referral link</span>
                </div>
                <p className="mb-2 text-[11px] leading-4 text-gray-500 dark:text-gray-400">Invite a new user and earn ₦300 when they buy ₦3,000+ worth of products.</p>
                <button onClick={copyReferralLink} disabled={!referralLink} className="flex w-full items-center gap-2 rounded-lg bg-[#0B0F14] px-3 py-2 text-left text-[10px] font-medium text-white disabled:opacity-50">
                  <span className="min-w-0 flex-1 truncate">{referralLink || "Sign in again to generate your link"}</span>
                  <Copy className="h-4 w-4 shrink-0 text-[#FFC107]" />
                </button>
              </div>
              <button
                onClick={() => {
                  window.open('https://drive.google.com/drive/folders/10zf4evrldtQlb6L5NkPMwTSOs1WW3y7d', '_blank');
                  setShowMenuDrawer(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                  <LogIn className="h-5 w-5 text-[#1565C0] dark:text-[#4d9cff]" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">How to Login</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Learn how to access your account</div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowBalanceModal(true);
                  setShowMenuDrawer(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-[#1565C0] dark:text-[#4d9cff]" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">Balance</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">View your account balance</div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowMenuDrawer(false);
                  navigate('/rules');
                }}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">Rules</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Terms and conditions</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowDepositHistory(true);
                  setShowMenuDrawer(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">Deposit History</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">View your fund additions</div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowCustomerCareOptions(!showCustomerCareOptions);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                  <Headphones className="h-5 w-5 text-[#1565C0] dark:text-[#4d9cff]" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">Customer Care</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Get help and support</div>
                </div>
                <div className={`transform transition-transform duration-200 ${showCustomerCareOptions ? 'rotate-180' : ''}`}>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </button>
              
              {showCustomerCareOptions && (
                <div className="ml-6 space-y-2 animate-in slide-in-from-top duration-200">
                  <button
                    onClick={() => {
                      window.open('https://chat.whatsapp.com/G3mMW8GxSg15yNRzNQ3f84', '_blank');
                      setShowMenuDrawer(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 dark:hover:bg-green-950 transition-colors rounded-lg"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-800 dark:text-gray-200">WhatsApp</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Chat with our team</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      window.open('https://t.me/officialsocialmediamarketplace', '_blank');
                      setShowMenuDrawer(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors rounded-lg"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#d5e5ff] dark:bg-[#0B0F14] flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-[#1565C0] dark:text-[#4d9cff]" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-800 dark:text-gray-200">Telegram</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Message our support</div>
                    </div>
                  </button>
                </div>
              )}

              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-gray-800 flex items-center justify-center">
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-gray-700" />
                  )}
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Toggle appearance</div>
                </div>
              </button>

              <button
                onClick={() => {
                  handleSignOut();
                  setShowMenuDrawer(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 dark:text-gray-200">Sign Out</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Log out of your account</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Balance Modal */}
      <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#1565C0]" />
              Account Balance & Statistics
            </DialogTitle>
            <DialogDescription>
              View your current balance and transaction history
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Current Balance */}
            <div className="bg-gradient-to-r from-[#e8f1ff] to-[#e8f1ff] dark:from-[#0B0F14] dark:to-[#0B0F14] p-6 rounded-xl border border-[#b0cdf5] dark:border-[#0a3d7c]">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Current Balance</div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]">
                  ₦{Math.max(0, user.balance || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Transaction Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Transaction Statistics</h3>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-[#09090b] p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-2">
                    <History className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Purchases</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{purchaseHistory.length}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>

                <div className="bg-white dark:bg-[#09090b] p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Banknote className="h-4 w-4 text-[#1565C0]" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Deposits</span>
                  </div>
                  <div className="text-2xl font-bold text-[#1565C0]">{depositHistory.length}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>

                <div className="bg-white dark:bg-[#09090b] p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Gift className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Referrals</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    ₦{referralBonuses.reduce((sum, b) => sum + (b.amount || 0), 0).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">{referralBonuses.length} bonuses</div>
                </div>
              </div>

              {/* Simple Transaction Chart */}
              <div className="bg-white dark:bg-[#09090b] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Recent Activity</h4>
                <div className="space-y-2">
                  {purchaseHistory.slice(0, 5).map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <div className="text-sm font-medium text-green-600">-₦{item.price.toFixed(2)}</div>
                    </div>
                  ))}
                  {depositHistory.slice(0, 3).map((deposit, index) => (
                    <div key={deposit._id || index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#1565C0] rounded-full"></div>
                        <span className="text-sm text-gray-800 dark:text-gray-200">Deposit</span>
                      </div>
                      <div className="text-sm font-medium text-[#1565C0]">+₦{deposit.amount?.toFixed(2)}</div>
                    </div>
                  ))}
                  {purchaseHistory.length === 0 && depositHistory.length === 0 && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      No transactions yet
                    </div>
                  )}
                </div>
              </div>

              {/* Referral Bonus History */}
              <div className="bg-white dark:bg-[#09090b] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Referral Bonus History</h4>
                <div className="space-y-2">
                  {referralBonuses.slice(0, 5).map((bonus, index) => (
                    <div key={bonus._id || index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <div className="text-sm text-gray-800 dark:text-gray-200">
                          {bonus.type === "referrer" ? "Referral reward" : "Signup bonus"}
                          <span className="block text-xs text-gray-500">
                            {bonus.type === "referrer" ? `from ${bonus.buyerEmail || "a user"}` : `via ${bonus.referrerEmail || "referrer"}`}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-purple-600">+₦{bonus.amount.toFixed(2)}</div>
                    </div>
                  ))}
                  {referralBonuses.length === 0 && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      No referral bonuses yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBalanceModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Social Support Icons */}
      {/* <div className="fixed bottom-8 left-6 z-50">
        <a
          href="https://chat.whatsapp.com/G3mMW8GxSg15yNRzNQ3f84"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all duration-300"
          aria-label="Contact us on WhatsApp"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      </div> */}

      {/* <div className="fixed bottom-8 right-6 z-50">
        <a
          href="https://t.me/officialsocialmediamarketplace"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 group"
          aria-label="Contact us on Telegram"
        >
          <div className="flex items-center justify-center w-14 h-14 bg-[#1565C0] hover:bg-[#1565C0] text-white rounded-full shadow-2xl group-hover:scale-110 transition-all duration-300">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </div>
        </a>
      </div> */}


      {/* Manual Funds Dialog */}
      <Dialog open={showManualFundsDialog} onOpenChange={setShowManualFundsDialog}>
        <DialogContent className="max-w-md bg-white dark:bg-black border-2 border-gray-100 dark:border-gray-800 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#1565C0]">
              <Banknote className="h-6 w-6 text-[#1565C0]" />
              Manual Funding
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Transfer the exact amount to the account below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
              <div className="p-4 bg-gray-50 dark:bg-[#09090b]/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Bank Name</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">Opay</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-[#1565C0] dark:text-[#4d9cff]">7031334372</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText("7031334372");
                      toast.success("Account number copied!");
                    }}
                    className="p-1 hover:bg-[#d5e5ff] dark:hover:bg-[#0B0F14]/30 rounded transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5 text-[#1565C0]" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Account Name</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">Adeosun Oluwatosin Toheeb</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">Description / Narration</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">Bills</span>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 p-3 rounded-lg flex gap-3 items-start">
              <div className="mt-0.5 bg-red-100 dark:bg-red-900/40 p-1 rounded-full">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-xs md:text-sm text-red-700 dark:text-red-300 font-medium">
                IMPORTANT: Please contact support immediately after making the payment with your proof of payment to get credited.
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
              variant="outline"
              onClick={() => {
                const details = `Bank: Opay\nAccount: 7031334372\nName: Adeosun Oluwatosin Toheeb\nDescription: Bills`;
                navigator.clipboard.writeText(details);
                toast.success("Bank details copied to clipboard!");
              }}
              className="w-full sm:w-auto border-[#b0cdf5] text-[#0d4f9f] hover:bg-[#e8f1ff]"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Details
            </Button>
              <Button
              onClick={() => {
                setShowManualFundsDialog(false);
                window.open('https://wa.me/2347031334372', '_blank');
              }}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              I've Paid
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowManualFundsDialog(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Money Dialog */}
      <Dialog open={showAddMoneyDialog} onOpenChange={setShowAddMoneyDialog}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#7c3aed] to-[#4c1d95] p-5 text-white">
            <DialogHeader className="pb-0">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Add Money
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Enter amount to fund your wallet
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₦</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  min="100"
                  step="100"
                  className="pl-8 h-14 text-xl font-bold border-2 border-gray-200 dark:border-gray-700 focus:border-[#7c3aed] rounded-xl"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick select</p>
              <div className="grid grid-cols-3 gap-2">
                {[1000, 5000, 10000, 20000, 50000, 100000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setAddFundsAmount(amount.toString())}
                    className="py-2.5 px-3 rounded-xl border border-purple-100 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 text-sm font-semibold text-[#7c3aed] dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors"
                  >
                    ₦{amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={proceedToPaymentMethod}
              className="w-full h-12 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold rounded-xl"
            >
              Select Payment Method
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert Currency Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ArrowRightLeft className="h-5 w-5 text-teal-500" />
              Convert Currency
            </DialogTitle>
            <DialogDescription>
              See your Naira balance in USD equivalent
            </DialogDescription>
          </DialogHeader>
          <div className="p-2 space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
              <p className="text-sm text-white/80 mb-1">Your balance</p>
              <p className="text-3xl font-black">₦{Math.max(0, user?.balance || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-gray-500" />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
              <p className="text-sm text-white/80 mb-1">USD equivalent</p>
              <p className="text-3xl font-black">${(Math.max(0, user?.balance || 0) / EXCHANGE_RATE).toFixed(2)}</p>
              <p className="text-xs text-white/70 mt-1">Rate: ₦{EXCHANGE_RATE} = $1</p>
            </div>
            <Button onClick={() => setShowConvertDialog(false)} className="w-full h-11 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Money Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Send className="h-5 w-5 text-rose-500" />
              Send Money
            </DialogTitle>
            <DialogDescription>
              Transfer money to another user by email
            </DialogDescription>
          </DialogHeader>
          <div className="p-2 space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 text-white">
              <p className="text-sm text-white/80 mb-1">Available balance</p>
              <p className="text-3xl font-black">₦{Math.max(0, user?.balance || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipient email</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={transferEmail}
                onChange={(e) => setTransferEmail(e.target.value)}
                className="h-12 rounded-xl bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₦)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="h-12 rounded-xl bg-white dark:bg-[#101820] border-gray-200 dark:border-gray-800"
              />
            </div>
            <Button
              onClick={handleTransfer}
              disabled={transferLoading}
              className="w-full h-12 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold"
            >
              {transferLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>Send Money <Send className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setShowNotificationsDrawer(false)}
          />
          <div className={`fixed top-0 right-0 h-[100dvh] w-80 max-w-[85vw] bg-white dark:bg-black shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
            showNotificationsDrawer ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#7c3aed]" />
                Notifications
              </h2>
              <button
                onClick={() => setShowNotificationsDrawer(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 px-4 space-y-3">
              {/* Platform update notification */}
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-800/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">New Telegram Channel</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Our previous channel was banned. Join the new channel for updates.</p>
                    <button
                      onClick={() => window.open("https://t.me/officialsocialmediamarketplace", "_blank")}
                      className="text-xs font-semibold text-[#7c3aed] mt-1 hover:underline"
                    >
                      Join now
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent purchases */}
              {purchaseHistory.slice(0, 5).map((item) => (
                <div key={item.id + item.purchaseDate} className="p-3 rounded-xl bg-gray-50 dark:bg-[#09090b] border border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Purchase completed</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">You bought {item.name} x{item.quantity}</p>
                  <p className="text-xs text-[#7c3aed] font-medium mt-1">-{item.price * item.quantity}</p>
                </div>
              ))}

              {/* Recent deposits */}
              {depositHistory.filter(d => d.status === 'success' || d.status === 'completed').slice(0, 3).map((d, i) => (
                <div key={d._id || i} className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/50">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Wallet funded</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.method?.toUpperCase()} deposit successful</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">+₦{d.amount?.toFixed(2)}</p>
                </div>
              ))}

              {purchaseHistory.length === 0 && depositHistory.length === 0 && (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent notifications</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Payment Method Selection Dialog */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-xl">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
             <DialogDescription>
              Choose how you want to add funds to your wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button onClick={handleQuickPay} disabled={isCreatingQuickPay} className="w-full h-14 justify-start px-4 text-left font-semibold text-base bg-[#1565C0] hover:bg-[#0d4f9f] shadow-md">
              <Zap className="mr-3 h-5 w-5" />
              {isCreatingQuickPay ? "Preparing Quick Pay..." : "Quick Pay"}
            </Button>
            <Button onClick={() => toast.info("Instant payment (ERCAS) coming soon")} className="w-full h-14 justify-start px-4 text-left font-semibold text-base bg-[#1565C0] hover:bg-[#0d4f9f] shadow-md">
              <CreditCard className="mr-3 h-5 w-5" />
              Instant payment (ercas)
            </Button>
            <Button onClick={() => {
                setShowPaymentMethodDialog(false);
                setShowManualFundsDialog(true);
            }} variant="outline" className="w-full h-14 justify-start px-4 text-left font-semibold text-base border-2 hover:bg-gray-50 dark:hover:bg-[#18181b]">
              <Banknote className="mr-3 h-5 w-5" />
              Manual deposit
            </Button>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setShowPaymentMethodDialog(false)} className="w-full">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Pay Details Dialog */}
      <Dialog open={showQuickPayDetailsDialog} onOpenChange={setShowQuickPayDetailsDialog}>
        <DialogContent className="sm:max-w-md w-[90%] rounded-xl">
          <DialogHeader>
            <DialogTitle>Quick Pay Details</DialogTitle>
            <DialogDescription>
              Use the account details below to complete your wallet funding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-xs text-gray-500">Bank</p>
              <p className="font-semibold">{quickPayDetails?.bankName || "PocketFi"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Account Name</p>
              <p className="font-semibold">{quickPayDetails?.accountName || "Pending"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Account Number</p>
              <p className="font-semibold break-all">{quickPayDetails?.accountNumber || "Pending"}</p>
            </div>
            {quickPayDetails?.paymentReference && (
              <div>
                <p className="text-xs text-gray-500">Reference</p>
                <p className="font-mono text-sm break-all">{quickPayDetails.paymentReference}</p>
              </div>
            )}
            {quickPayDetails?.message && (
              <div className="rounded-lg bg-gray-50 dark:bg-[#111111] p-3 text-sm text-gray-700 dark:text-gray-300">
                {quickPayDetails.message}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickPayDetailsDialog(false)} className="w-full">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-100 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-safe">
        <div className="flex items-end justify-around px-2 pt-2 pb-3">
          <button
            onClick={() => navigate("/")}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all duration-300 group min-w-0 flex-1"
            aria-label="Home"
          >
            <Home className="h-5 w-5 text-[#7c3aed] dark:text-purple-400 transition-colors" />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors">Home</span>
          </button>

          <button
            onClick={scrollToProducts}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all duration-300 group min-w-0 flex-1"
            aria-label="Shop"
          >
            <LayoutGrid className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors" />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors">Shop</span>
          </button>

          {/* Center Add Money Button */}
          <div className="flex flex-col items-center -mt-6 min-w-0 flex-1">
            <button
              onClick={openAddMoneyDialog}
              className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-lg shadow-purple-500/30 transition-all duration-300 hover:scale-105"
              aria-label="Add money"
            >
              <Plus className="h-7 w-7" />
            </button>
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mt-1">Add money</span>
          </div>

          <button
            onClick={() => setShowPurchaseHistory(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all duration-300 group min-w-0 flex-1 relative"
            aria-label="Orders"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors" />
              {purchaseHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-lg">
                  {purchaseHistory.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors">Orders</span>
          </button>

          <button
            onClick={() => setShowMenuDrawer(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all duration-300 group min-w-0 flex-1"
            aria-label="More"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors" />
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#7c3aed] dark:group-hover:text-purple-400 transition-colors">More</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Shop;
