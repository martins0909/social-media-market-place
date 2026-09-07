import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Menu, MoreVertical, ChevronDown, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate, useLocation } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { catalogCategoriesAPI } from "@/lib/api";
import logo from "@/assets/pics (2).png";

interface NavbarProps {
  isShopPage?: boolean;
  cartItemCount?: number;
  onCartClick?: () => void;
  onMenuClick?: () => void;
  onGeneralMenuClick?: () => void;

  // Shop page (user dashboard) optional menus
  shopCategories?: string[];
  onShopCategorySelect?: (category: string) => void;
  onShopBalanceClick?: () => void;
  onShopPurchaseHistoryClick?: () => void;
  onShopDepositHistoryClick?: () => void;
  onShopSignOutClick?: () => void;
}

const Navbar = ({
  isShopPage = false,
  cartItemCount = 0,
  onCartClick,
  onMenuClick,
  onGeneralMenuClick,
  shopCategories,
  onShopCategorySelect,
  onShopBalanceClick,
  onShopPurchaseHistoryClick,
  onShopDepositHistoryClick,
  onShopSignOutClick,
}: NavbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const shopCategoryList = (shopCategories || []).filter(Boolean);

  useEffect(() => {
    if (!isShopPage) {
      catalogCategoriesAPI.getAll().then(res => setCategories(res)).catch(() => {});
    }
  }, [isShopPage]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/" && params.get("focusSearch") === "1") {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
      params.delete("focusSearch");
      const nextSearch = params.toString();
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [searchOpen]);

  const submitProductSearch = (rawValue: string) => {
    const term = rawValue.trim();
    if (!term) return;
    navigate(`/?product=${encodeURIComponent(term)}`);
    setSearchOpen(false);
  };

  const scrollToCategory = (categoryName: string) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById(`category-${categoryName}`);
        if (el) {
          const headerOffset = 100;
          const elementPosition = el.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
      }, 500);
      return;
    }

    const element = document.getElementById(`category-${categoryName}`);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  return (
    <nav className="fixed top-4 left-4 right-4 md:top-6 md:left-8 md:right-8 z-50 bg-white/80 backdrop-blur-md border border-gray-100 dark:border-gray-800 dark:bg-black/80 rounded-2xl shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            {isShopPage && onMenuClick && (
              <button
                onClick={onMenuClick}
                className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            
            {/* Mobile Category Dropdown Menu (on non-shop pages) now placed BEFORE the logo */}
            {!isShopPage && (
               <div className="md:hidden -ml-2">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors" aria-label="Menu">
                        <Menu className="h-6 w-6 text-[#1565C0] dark:text-[#4d9cff]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 max-h-72 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#09090b] border-2 border-[#1565C0] rounded-xl shadow-lg p-1">
                      {categories.length > 0 ? (
                        categories.map((cat) => (
                          <DropdownMenuItem 
                            key={cat.id} 
                            onClick={() => scrollToCategory(cat.name)}
                            className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                          >
                            {cat.name}
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled className="text-gray-500">Loading...</DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="bg-[#b0cdf5] dark:bg-[#0a3d7c]" />

                      <DropdownMenuItem
                        onClick={() => navigate("/faq")}
                        className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                      >
                        FAQ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
               </div>
            )}

            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}> 
              <img src={logo} alt="Social Media Marketplace" className="h-9 w-auto max-w-[190px] object-contain" />
            </div>

            {/* Shop: Desktop Category Dropdown */}
            {isShopPage && shopCategoryList.length > 0 && onShopCategorySelect && (
              <div className="hidden md:flex items-center ml-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="border-2 border-[#1565C0] text-[#0d4f9f] dark:text-[#8fb5e8] hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14]/20 rounded-full h-9 px-4"
                    >
                      Category
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#09090b] border-2 border-[#1565C0] rounded-xl shadow-lg p-1">
                    {shopCategoryList.map((cat) => (
                      <DropdownMenuItem
                        key={cat}
                        onClick={() => onShopCategorySelect(cat)}
                        className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                      >
                        {cat}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 md:gap-3">
            {!isShopPage && (
              <div className="hidden md:flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="p-0 border-2 border-[#1565C0] focus-visible:ring-0 focus-visible:outline-none focus:ring-0 focus:outline-none outline-none ring-0 rounded-full h-9 md:h-10 overflow-hidden flex shadow-sm">
                      <div className="bg-[#1565C0] hover:bg-[#1565C0] text-white flex items-center h-full px-3 md:px-4 text-xs md:text-sm font-medium transition-colors outline-none focus:outline-none">
                        Select Category
                      </div>
                      <div className="bg-[#0d4f9f] hover:bg-[#0a3d7c] text-white flex items-center justify-center h-full px-2 md:px-3 transition-colors outline-none focus:outline-none">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#09090b] border-2 border-[#1565C0] rounded-xl shadow-lg p-1">
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <DropdownMenuItem
                          key={cat.id}
                          onClick={() => scrollToCategory(cat.name)}
                          className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                        >
                          {cat.name}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled className="text-gray-500">Loading...</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/faq")}
                className="hidden md:inline-flex text-[#0d4f9f] dark:text-[#8fb5e8] hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14]/20"
              >
                FAQ
              </Button>
              </div>
            )}

            {/* Product search */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSearchOpen(v => !v)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors"
                aria-label="Search products"
              >
                <Search className="h-5 w-5 text-[#1565C0] dark:text-[#4d9cff]" />
              </button>

              {searchOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitProductSearch(searchValue);
                  }}
                  className="absolute right-0 mt-2 w-56 md:w-72 bg-white/95 dark:bg-black/95 backdrop-blur border border-gray-200 dark:border-gray-800 rounded-xl p-2 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      ref={searchInputRef}
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Enter product name"
                      className="h-9"
                    />
                    <Button
                      type="submit"
                      className="h-9 px-3 bg-[#1565C0] hover:bg-[#0d4f9f] text-white rounded-lg"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}
            </div>

            <ThemeToggle />

            {/* Shop: Desktop right-side Menu dropdown */}
            {isShopPage && (
              <div className="hidden md:flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      className="border-2 border-[#1565C0] text-[#0d4f9f] dark:text-[#8fb5e8] hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14]/20 rounded-full h-9 px-4"
                    >
                      Menu
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[#09090b] border-2 border-[#1565C0] rounded-xl overflow-hidden shadow-lg p-1">
                    {onShopBalanceClick && (
                      <DropdownMenuItem
                        onClick={onShopBalanceClick}
                        className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                      >
                        Balance
                      </DropdownMenuItem>
                    )}
                    {onShopPurchaseHistoryClick && (
                      <DropdownMenuItem
                        onClick={onShopPurchaseHistoryClick}
                        className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                      >
                        Purchase History
                      </DropdownMenuItem>
                    )}
                    {onShopDepositHistoryClick && (
                      <DropdownMenuItem
                        onClick={onShopDepositHistoryClick}
                        className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                      >
                        Deposit History
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator className="bg-[#b0cdf5] dark:bg-[#0a3d7c]" />
                    <DropdownMenuItem
                      onClick={() => navigate("/rules")}
                      className="cursor-pointer font-medium text-[#0B0F14] dark:text-[#d5e5ff] hover:text-[#0d4f9f] hover:bg-[#d5e5ff] focus:text-[#0d4f9f] focus:bg-[#d5e5ff] dark:focus:bg-[#0B0F14]/40 outline-none rounded-lg py-2"
                    >
                      Rules
                    </DropdownMenuItem>
                    {onShopSignOutClick && (
                      <DropdownMenuItem
                        onClick={onShopSignOutClick}
                        className="cursor-pointer font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/30 outline-none rounded-lg py-2"
                      >
                        Sign Out
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {isShopPage && onGeneralMenuClick && (
              <button
                onClick={onGeneralMenuClick}
                className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#18181b] transition-colors"
                aria-label="Open general menu"
              >
                <MoreVertical className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}
            {isShopPage ? (
              <div className="relative cursor-pointer group hidden md:block" onClick={onCartClick}>
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#09090b] flex items-center justify-center hover:bg-[#e8f1ff] dark:hover:bg-[#0B0F14]/20 transition-colors">
                  <History className="h-5 w-5 text-gray-700 dark:text-gray-300 group-hover:text-[#1565C0] dark:group-hover:text-[#4d9cff]" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#1565C0] text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white dark:border-gray-900">
                      {cartItemCount}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => navigate("/auth")}
                className="h-8 md:h-10 px-3 md:px-6 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-medium rounded-full text-xs md:text-sm transition-all shadow-none hover:shadow-md"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
