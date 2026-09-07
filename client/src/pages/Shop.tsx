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
import { Banknote, ChevronDown, History, Copy, Home, Menu, LogIn, FileText, Headphones, MessageCircle, Wallet, Eye, EyeOff, CreditCard, Zap } from "lucide-react";
import bannerImg from "@/assets/ban.jpg";
import bannerLog1 from "@/assets/bannerlog1.jpg";
import bannerLog2 from "@/assets/bannerlog2.jpg";
import bannerLog3 from "@/assets/bannerlogo3.png";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Plus, LogOut, BadgeCheck, X, ShoppingCart, Minus, Send } from "lucide-react";
import logo from "@/assets/pics (2).png";
// Removed demo product assets; shop now shows only database products

interface SerialNumber {
  id: string;
  serial: string;
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
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loadingProducts, setLoadingProducts] = useState(true);
  // Categories from API
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});

  const [showNotificationModal, setShowNotificationModal] = useState(true);

  // New: Purchase summary dialog state
  const [showPurchaseSummaryDialog, setShowPurchaseSummaryDialog] = useState(false);
  const [showManualFundsDialog, setShowManualFundsDialog] = useState(false);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
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
          return {
            ...p,
            availableStock: typeof result.updatedProduct?.availableStock === "number"
              ? result.updatedProduct.availableStock
              : (typeof p.availableStock === "number" ? Math.max(0, p.availableStock - purchaseQuantity) : p.availableStock)
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
    ? `${window.location.origin}/auth?ref=${encodeURIComponent(user.referralCode)}`
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black relative pb-20 transition-colors duration-300">
      {/* Animated gradient orbs */}
      {/* <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#4d9cff]/20 to-[#4d9cff]/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-[#4d9cff]/20 to-[#4d9cff]/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-[#4d9cff]/15 to-[#4d9cff]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div> */}
      
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
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed px-1 sm:px-2">
              Our previous Telegram channel has been banned. kindly use the link below to join our new channel and contact the new support number for assistance
            </p>
            
            <div className="w-full flex justify-center py-2">
              <Button 
                onClick={() => window.open("https://t.me/+0v09JFhl1sZjYTlk", "_blank")}
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
                  navigator.clipboard.writeText("https://t.me/+0v09JFhl1sZjYTlk");
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

      <div className="pt-20 md:pt-24 relative">
        {/* Banner Section with Welcome Badge - Full Width */}
        <div className="relative mb-6 animate-in fade-in slide-in-from-top duration-500">
          {/* <a 
            href="https://chat.whatsapp.com/HCE6nkuaxXm4j2ugwW5exb" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:block relative overflow-hidden rounded-2xl shadow-xl border-2 border-white/60 dark:border-gray-800 hover:border-[#4d9cff] transition-colors mx-auto w-3/4 md:w-full"
          >
            <img
              src={bannerImg}
              alt="Premium products banner"
              className="w-full h-7 md:h-44 object-cover select-none"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14]/20 via-[#0B0F14]/20 to-[#0B0F14]/20 mix-blend-multiply"></div>
          </a> */}
          
          {/* Title moved below banner */}
          <h1 className="mt-2 md:mt-6 text-center text-3xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0] tracking-tight">
            <span className="hidden md:inline">Shop Correct LOGs</span>
          </h1>

          <div className="mx-auto mb-3 block max-w-[calc(100%-2rem)] overflow-hidden rounded-full border border-[#1565C0]/20 bg-[#0B0F14] px-3 py-2 text-center shadow-[0_0_24px_rgba(21,101,192,0.2)] md:hidden">
            <div className="marquee-track inline-flex whitespace-nowrap text-[10px] font-bold tracking-wide text-[#FFC107]">
              we have sold 1.8 million accounts and still counting, join us today · our services are quick, reliable and affordable ·&nbsp;
            </div>
          </div>

          {/* Welcome badge positioned below the announcement */}
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
            
            {/* Header Section (subtitle only now, main title moved into banner) */}
            {/* <div className="text-center mb-8 md:mb-12 animate-in fade-in slide-in-from-top duration-700 px-6 md:px-0">
              <div className="max-w-3xl mx-auto flex justify-center">
                <Carousel setApi={setApi} opts={{ loop: true }} className="w-full">
                  <CarouselContent>
                    {[bannerLog1, bannerLog2, bannerLog3].map((img, index) => (
                      <CarouselItem key={index} className="w-full">
                        <img 
                          src={img} 
                          alt={`Banner ${index + 1}`} 
                          className="w-full h-[20vh] object-cover rounded-xl shadow-sm"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              </div>
            </div> */}

            {/* Mobile wallet card */}
            <Card className="block md:hidden mb-6 overflow-hidden rounded-2xl border border-[#1565C0]/30 bg-white shadow-[0_10px_40px_rgba(21,101,192,0.18),0_0_18px_rgba(255,193,7,0.1)] dark:border-white/10 dark:bg-[#101820] animate-in fade-in duration-700">
              <CardHeader className="p-4 pb-3">
                <div className="rounded-xl bg-[#0B0F14] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 backdrop-blur-sm">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2"><img src={logo} alt="Social Media Marketplace" className="h-5 w-auto max-w-[145px] object-contain" /><span className="text-[9px] font-bold uppercase tracking-wider text-[#FFC107]">social media market place</span></div>
                  </div>
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <CardTitle className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#d5e5ff]">Available Balance</CardTitle>
                    <CardDescription className="flex items-center text-sm font-medium text-[#d5e5ff]">
                      <span className="ml-0 text-3xl font-black tracking-tight text-white">
                        {showBalance ? `₦${Math.max(0, user.balance || 0).toFixed(2)}` : '••••••'}
                      </span>
                      <button 
                        onClick={() => setShowBalance(!showBalance)} 
                        className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
                        aria-label={showBalance ? "Hide balance" : "Show balance"}
                      >
                        {showBalance ? <EyeOff className="h-4 w-4 text-[#d5e5ff]" /> : <Eye className="h-4 w-4 text-[#d5e5ff]" />}
                      </button>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    className="h-10 border-2 border-gray-200 dark:border-gray-700 focus:border-[#1565C0] transition-all duration-300 rounded-xl bg-white dark:bg-[#09090b] text-gray-900 dark:text-gray-100 text-sm"
                  />
                  <Button 
                    onClick={handleAddFunds}
                    className="h-10 px-4 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl text-sm w-full"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Add Funds
                  </Button>
                </div>
                <p className="mt-4 border-t border-gray-200 pt-3 text-xs font-semibold text-gray-500 dark:border-white/10 dark:text-white/60">{user.name || user.email.split("@")[0]}</p>
              </CardContent>
            </Card>

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
            <div className="grid lg:grid-cols-1 gap-8">
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
                          {displayedProducts.map((product, index) => {
                            const availableStock = typeof product.availableStock === "number"
                              ? product.availableStock
                              : (product.serialNumbers || []).filter(s => !s.isUsed).length;
                            
                            return (
                            <Card 
                              key={product.id} 
                              className="bg-white/90 backdrop-blur-xl shadow-lg border-2 border-l-0 border-r-0 md:border-l-2 md:border-r-2 border-white/60 hover:shadow-xl transition-all duration-300 group animate-in fade-in slide-in-from-bottom dark:bg-black/90 dark:border-gray-800 mx-2 md:mx-0 rounded-lg md:rounded-lg overflow-hidden"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row md:items-center gap-0 md:gap-4 md:p-4 p-3 min-w-0">
                                  {/* Top Section: Image and Info (Mobile Full Width) */}
                                  <div className="flex items-start gap-3 p-0 md:p-0 md:flex-1 min-w-0 w-full">
                                    {/* Small Product Image */}
                                    <div className="relative overflow-hidden rounded-lg flex-shrink-0">
                                      <div className="absolute inset-0 bg-gradient-to-br from-[#4d9cff]/0 to-[#4d9cff]/0 group-hover:from-[#4d9cff]/20 group-hover:to-[#4d9cff]/20 transition-all duration-300 z-10"></div>
                                      <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                                      />
                                    </div>
                                    
                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start gap-2 mb-0.5 md:mb-1">
                                        <Badge variant="outline" className="px-1.5 md:px-2 py-0.5 text-xs tracking-wide bg-gradient-to-r from-[#d5e5ff] to-[#d5e5ff] text-[#0d4f9f] border-none flex-shrink-0 dark:from-[#0B0F14] dark:to-[#0B0F14] dark:text-[#4d9cff]">
                                          {product.category}
                                        </Badge>
                                        {availableStock > 0 && (
                                          <Badge variant="outline" className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c]">
                                              {availableStock} in stock
                                            </Badge>
                                          )}
                                        {availableStock === 0 && (
                                          <Badge variant="outline" className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                            Out of stock
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between gap-3 w-full min-w-0">
                                        <h3 className="font-bold text-sm md:text-base lg:text-lg mb-0.5 md:mb-1 bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c] dark:from-[#4d9cff] dark:to-[#1565C0] whitespace-normal break-words leading-tight md:truncate flex-1 min-w-0">{product.name}</h3>
                                      </div>
                                    </div>
                                    
                                    {/* Price (Mobile - Right Side) */}
                                    <div className="text-right flex-shrink-0 md:hidden">
                                     
                                      {/* {availableStock === 0 && (
                                        <div className="mt-0.5">
                                          <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                            Out of stock
                                          </Badge>
                                        </div>
                                      )} */}
                                    </div>
                                  </div>

                                  {/* Description (Mobile Full Width) */}
                                  <div className="px-0 pb-3 md:hidden min-w-0">
                                    <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-normal break-words leading-relaxed">{product.description}</p>
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
                                        disabled={availableStock === 0}
                                        className={`h-9 px-4 ${availableStock === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1565C0] hover:bg-[#0d4f9f]'} text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg text-sm`}
                                      >
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        {availableStock === 0 ? 'Out of Stock' : 'Buy Now'}
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Buy Button and Price (Mobile Full Width) */}
                                  <div className="pl-0 pr-0 pb-3 md:p-0 md:flex-shrink-0 md:hidden flex flex-wrap items-start justify-between gap-2 min-w-0">
                                    <Button 
                                      onClick={() => handleBuyClick(product)}
                                      disabled={availableStock === 0}
                                      className={`h-8 px-3 shrink-0 ${availableStock === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1565C0] hover:bg-[#0d4f9f]'} text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg text-xs`}
                                    >
                                      <ShoppingCart className="h-3 w-3 mr-1" />
                                      {availableStock === 0 ? 'Out of Stock' : 'Buy Now'}
                                    </Button>
                                    <div className="flex flex-col items-end min-w-0 max-w-full">
                                      <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#4d9cff] dark:from-[#4d9cff] dark:to-[#8fb5e8] break-all text-right leading-tight">
                                        ₦{product.price.toFixed(2)}
                                      </span>
                                      {availableStock > 0 ? (
                                        <Badge variant="outline" className="mt-1 px-1.5 py-0.5 text-[10px] bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c] block whitespace-normal break-words text-center max-w-[110px]">
                                          {availableStock} in stock
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="mt-1 px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 block whitespace-normal break-words text-center max-w-[110px]">
                                          Out of stock
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            );
                          })}
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
                            {displayedProducts.map((product, index) => {
                        const availableStock = typeof product.availableStock === "number"
                          ? product.availableStock
                          : (product.serialNumbers || []).filter(s => !s.isUsed).length;
                        
                        return (
                        <Card 
                          key={product.id} 
                          className="bg-white/90 backdrop-blur-xl shadow-lg border-2 border-l-0 border-r-0 md:border-l-2 md:border-r-2 border-white/60 hover:shadow-xl transition-all duration-300 group animate-in fade-in slide-in-from-bottom dark:bg-black/90 dark:border-gray-800 mx-2 md:mx-0 rounded-lg md:rounded-lg overflow-hidden"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row md:items-center gap-0 md:gap-4 md:p-4 p-3 min-w-0">
                              {/* Top Section: Image and Info (Mobile Full Width) */}
                              <div className="flex items-start gap-3 p-0 md:p-0 md:flex-1 min-w-0 w-full">
                                {/* Small Product Image */}
                                <div className="relative overflow-hidden rounded-lg flex-shrink-0">
                                  <div className="absolute inset-0 bg-gradient-to-br from-[#4d9cff]/0 to-[#4d9cff]/0 group-hover:from-[#4d9cff]/20 group-hover:to-[#4d9cff]/20 transition-all duration-300 z-10"></div>
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-12 h-12 md:w-16 md:h-16 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                                  />
                                </div>
                                
                                {/* Product Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 mb-0.5 md:mb-1">
                                    <Badge variant="outline" className="px-1.5 md:px-2 py-0.5 text-xs tracking-wide bg-gradient-to-r from-[#d5e5ff] to-[#d5e5ff] text-[#0d4f9f] border-none flex-shrink-0 dark:from-[#0B0F14] dark:to-[#0B0F14] dark:text-[#4d9cff]">
                                      {product.category}
                                    </Badge>
                                    {availableStock > 0 && (
                                      <Badge variant="outline" className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c]">
                                        {availableStock} in stock
                                      </Badge>
                                    )}
                                    {availableStock === 0 && (
                                      <Badge variant="outline" className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                        Out of stock
                                      </Badge>
                                    )} 
                                  </div>
                                  <h3 className="font-bold text-sm md:text-base lg:text-lg mb-0.5 md:mb-1 bg-clip-text text-transparent bg-gradient-to-r from-[#0d4f9f] to-[#0a3d7c] dark:from-[#4d9cff] dark:to-[#1565C0] whitespace-normal break-words leading-tight md:truncate">{product.name}</h3>
                                  {/* Desktop-only stock line under product name to avoid name overflow */}
                                  {availableStock > 0 ? (
                                    <div className="hidden md:block mt-1">
                                      <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c]">
                                        {availableStock} in stock
                                      </Badge>
                                    </div>
                                  ) : (
                                    <div className="hidden md:block mt-1">
                                      <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                                        Out of stock
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Price (Mobile) - moved to buy button area to avoid duplication */}
                                <div className="hidden" />
                              </div>

                              {/* Description (Mobile Full Width) */}
                              <div className="px-0 pb-3 md:hidden min-w-0">
                                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-normal break-words leading-relaxed">{product.description}</p>
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
                                    disabled={availableStock === 0}
                                    className={`h-9 px-4 ${availableStock === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1565C0] hover:bg-[#0d4f9f]'} text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg text-sm`}
                                  >
                                    <ShoppingCart className="h-4 w-4 mr-2" />
                                    {availableStock === 0 ? 'Out of Stock' : 'Buy Now'}
                                  </Button>
                                </div>
                              </div>

                              {/* Buy Button and Price (Mobile Full Width) */}
                              <div className="pl-0 pr-0 pb-3 md:p-0 md:flex-shrink-0 md:hidden flex flex-wrap items-start justify-between gap-2 min-w-0">
                                <Button 
                                  onClick={() => handleBuyClick(product)}
                                  disabled={availableStock === 0}
                                  className={`h-8 px-3 shrink-0 ${availableStock === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1565C0] hover:bg-[#0d4f9f]'} text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg text-xs`}
                                >
                                  <ShoppingCart className="h-3 w-3 mr-1" />
                                  {availableStock === 0 ? 'Out of Stock' : 'Buy Now'}
                                </Button>
                                <div className="flex flex-col items-end min-w-0 max-w-full">
                                  <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0] break-all text-right leading-tight">
                                    ₦{product.price.toFixed(2)}
                                  </span>
                                  {availableStock > 0 ? (
                                    <Badge variant="outline" className="mt-1 px-1.5 py-0.5 text-[10px] bg-[#e8f1ff] text-[#0d4f9f] border-[#b0cdf5] dark:bg-[#0B0F14] dark:text-[#4d9cff] dark:border-[#0a3d7c] block whitespace-normal break-words text-center max-w-[110px]">
                                      {availableStock} in stock
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="mt-1 px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 block whitespace-normal break-words text-center max-w-[110px]">
                                      Out of stock
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
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
                    onClick={() => window.open('https://chat.whatsapp.com/HCE6nkuaxXm4j2ugwW5exb', '_blank')}
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
                    onClick={() => window.open('https://t.me/+0v09JFhl1sZjYTlk', '_blank')}
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
      {/* Floating Telegram Support (bottom-right) */}
      <div className="fixed bottom-8 right-6 z-50">
        <a
          href="https://t.me/+0v09JFhl1sZjYTlk"
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
          <span className="text-xs font-medium text-gray-700 bg-white/80 backdrop-blur px-2 py-1 rounded-full shadow">online agent</span>
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
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#1565C0]">Your referral link</span>
                  <span className="text-[10px] font-bold text-[#FFC107]">+₦100 each</span>
                </div>
                <p className="mb-2 text-[11px] leading-4 text-gray-500 dark:text-gray-400">Invite a new user and earn ₦100 when they sign up.</p>
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
                      window.open('https://chat.whatsapp.com/HCE6nkuaxXm4j2ugwW5exb', '_blank');
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
                      window.open('https://t.me/+0v09JFhl1sZjYTlk', '_blank');
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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#09090b] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Purchases</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{purchaseHistory.length}</div>
                  <div className="text-xs text-gray-500">Total transactions</div>
                </div>
                
                <div className="bg-white dark:bg-[#09090b] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="h-4 w-4 text-[#1565C0]" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Deposits</span>
                  </div>
                  <div className="text-2xl font-bold text-[#1565C0]">{depositHistory.length}</div>
                  <div className="text-xs text-gray-500">Fund additions</div>
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
          href="https://chat.whatsapp.com/HCE6nkuaxXm4j2ugwW5exb"
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
          href="https://t.me/+0v09JFhl1sZjYTlk"
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
                <span className="font-bold text-gray-900 dark:text-gray-100">Moniepoint (MFB)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold text-[#1565C0] dark:text-[#4d9cff]">5022156956</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText("unavailable");
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
                <span className="font-bold text-gray-900 dark:text-gray-100">Okeke Victor Udochukwu</span>
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
                const details = `Bank: Moniepoint (MFB)\nAccount: unavailable\nName: Okeke Victor Udochukwu\nDescription: Bills`;
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
                window.open('https://wa.me/2349026876097', '_blank');
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
            <Button onClick={() => initiateErcasPayment()} className="w-full h-14 justify-start px-4 text-left font-semibold text-base bg-[#1565C0] hover:bg-[#0d4f9f] shadow-md">
              <CreditCard className="mr-3 h-5 w-5" />
              Instant payment (ercas)
            </Button>
            <Button onClick={handleQuickPay} disabled={isCreatingQuickPay} className="w-full h-14 justify-start px-4 text-left font-semibold text-base bg-[#1565C0] hover:bg-[#0d4f9f] shadow-md">
              <Zap className="mr-3 h-5 w-5" />
              {isCreatingQuickPay ? "Preparing Quick Pay..." : "Quick Pay"}
            </Button>
            <Button onClick={() => {
                setShowPaymentMethodDialog(false);
                setShowManualFundsDialog(true);
            }} variant="outline" className="w-full h-14 justify-start px-4 text-left font-semibold text-base border-2 hover:bg-gray-50 dark:hover:bg-[#18181b]">
              <Banknote className="mr-3 h-5 w-5" />
              Manual deposit unavailable!
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t-2 border-white/60 dark:border-gray-800 shadow-2xl">
        <div className="flex items-center justify-around py-2 px-4">
          <button
            onClick={() => navigate("/")}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-all duration-300 group min-w-0 flex-1"
            aria-label="Home"
          >
            <Home className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors">Home</span>
          </button>
          
          <button
            onClick={() => {
              // Scroll to enter amount input
              const enterAmountInput = document.querySelector('input[placeholder="Enter amount"]');
              if (enterAmountInput) {
                enterAmountInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-all duration-300 group min-w-0 flex-1"
            aria-label="Add Funds"
          >
            <Wallet className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors">Fund</span>
          </button>
          
          <button
            onClick={() => setShowCategoryDrawer(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-all duration-300 group min-w-0 flex-1"
            aria-label="Categories"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors">Category</span>
          </button>
          
          <button
            onClick={() => setShowPurchaseHistory(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-all duration-300 group min-w-0 flex-1 relative"
            aria-label="Purchase History"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors" />
              {purchaseHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-lg">
                  {purchaseHistory.length}
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors">Order</span>
          </button>
          
          <button
            onClick={() => setShowDepositHistory(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14] transition-all duration-300 group min-w-0 flex-1"
            aria-label="Deposit History"
          >
            <History className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff] transition-colors">Deposit</span>
          </button>
          

        </div>
      </div>
    </div>
  );
};

export default Shop;
