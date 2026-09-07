import { useEffect, useRef, useState } from "react";
import { catalogAPI, catalogCategoriesAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function CategoryBanners() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const lastScrolledSearchRef = useRef<string | null>(null);
  const [visibleCountByCategory, setVisibleCountByCategory] = useState<Record<string, number>>({});

  const DEFAULT_VISIBLE = 5;
  const LOAD_STEP = 5;

  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedProducts, fetchedCategories] = await Promise.all([
          catalogAPI.getAll(),
          catalogCategoriesAPI.getAll(),
        ]);
        setProducts(fetchedProducts);
        setCategories(fetchedCategories);
      } catch (err) {
        console.error("Failed to load catalog data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (loading) return;

    const term = new URLSearchParams(location.search).get("product")?.trim();
    if (!term) return;
    if (lastScrolledSearchRef.current === term) return;

    const normalizedTerm = term.toLowerCase();
    const matched = products.find(p => `${p?.name ?? ""}`.toLowerCase().includes(normalizedTerm));
    if (!matched) return;

    const totalInCategory = products.filter(p => p?.category === matched.category).length;
    setVisibleCountByCategory(prev => ({
      ...prev,
      [matched.category]: Math.max(prev[matched.category] ?? DEFAULT_VISIBLE, totalInCategory),
    }));

    lastScrolledSearchRef.current = term;
    setTimeout(() => {
      const productEl = document.getElementById(`product-${matched.id}`);
      const targetEl = productEl ?? document.getElementById(`category-${matched.category}`);
      if (!targetEl) return;

      const headerOffset = 110;
      const elementPosition = targetEl.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }, 120);
  }, [loading, location.search, products]);

  if (loading) {
    return <div className="text-center py-20">Loading logs...</div>;
  }

  // Group products by category
  const groupedProducts: Record<string, any[]> = {};
  products.forEach(p => {
    if (!groupedProducts[p.category]) groupedProducts[p.category] = [];
    groupedProducts[p.category].push(p);
  });

  return (
    <section className="pt-2 pb-12 md:pt-4 md:pb-20 px-0 md:px-8 relative z-10 bg-gray-50 dark:bg-black">
      <div className="w-full max-w-7xl mx-auto">
        <h2 className="text-xl md:text-3xl font-extrabold text-[#1565C0] dark:text-[#4d9cff] mb-2 md:mb-3 text-center">
          LOGS
        </h2>

        <div className="space-y-12 md:space-y-16">
          {categories.map((cat) => {
            const catProducts = groupedProducts[cat.name] || [];
            if (catProducts.length === 0) return null;

            const visibleCount = visibleCountByCategory[cat.name] ?? DEFAULT_VISIBLE;
            const visibleProducts = catProducts.slice(0, visibleCount);

            return (
              <div key={cat.id}>
                <div id={`category-${cat.name}`} className="bg-white dark:bg-[#09090b] rounded-none md:rounded-2xl shadow-xl overflow-hidden border-y md:border border-gray-100 dark:border-gray-700">
                  <div className="bg-[#1565C0] dark:bg-[#0d4f9f] relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between px-2 md:px-6 pt-2 gap-1 md:gap-0">
                    <div className="flex items-center gap-2 md:gap-3 flex-1 overflow-hidden min-w-0 pr-2 pb-2">
                      {cat.icon && (
                        <img src={cat.icon} alt={cat.name} className="w-8 h-8 md:w-10 md:h-10 object-contain rounded bg-white/20 p-1 shrink-0" />
                      )}
                      <h3 className="text-sm md:text-xl font-bold text-white tracking-wide truncate">
                        {cat.name}
                      </h3>
                    </div>

                    <div className="w-full md:w-auto flex justify-end">
                      <div className="flex items-center text-[10px] md:text-xs font-bold text-white/95 uppercase tracking-wider shrink-0 bg-black/20 rounded-t-lg py-1.5 px-1 md:px-3">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-16 md:w-24 text-center">Stock</div>
                        <div className="w-20 md:w-28 text-center">Price</div>
                        <div className="w-16 md:w-[88px] text-center">Action</div>
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {visibleProducts.map((product, index) => {
                      const availableStock = typeof product.availableStock === "number"
                        ? product.availableStock
                        : (product.serialNumbers || []).filter((s: any) => !s.isUsed).length;
                      
                      return (
                        <div
                          id={`product-${product.id}`}
                          key={product.id}
                          className={`bg-white dark:bg-[#09090b] transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 w-full ${index !== visibleProducts.length - 1 ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}
                        >
                          <div className="flex flex-row items-center h-full">
                            {product.image && (
                              <div className="w-12 md:w-16 shrink-0 bg-gray-50 dark:bg-[#09090b] flex items-center justify-center p-1 md:p-2 border-r border-gray-100 dark:border-gray-700 self-stretch">
                                <img src={product.image} alt={product.name} className="h-8 w-8 md:h-10 md:w-10 object-cover rounded shadow-sm" />
                              </div>
                            )}
                            <div className="p-2 md:p-3 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4 overflow-hidden">
                              <div className="flex-1 min-w-0 pr-2">
                                <h4 className="text-sm md:text-lg font-bold text-gray-900 dark:text-white truncate">{product.name}</h4>
                                <p className="text-[10px] md:text-sm text-gray-600 dark:text-gray-400 whitespace-normal break-words md:truncate w-full">
                                  {product.description}
                                </p>
                              </div>
                              
                              <div className="flex items-center justify-end gap-2 md:gap-3 shrink-0 ml-auto mt-1 md:mt-0">
                                <div className="w-16 md:w-24 flex justify-center">
                                  <Badge
                                    variant="outline"
                                    className={`whitespace-nowrap text-[9px] md:text-xs px-2 py-1 rounded-md bg-[#e8f1ff] dark:bg-[#0B0F14]/20 border-[#b0cdf5] dark:border-[#0a3d7c] ${
                                      availableStock > 0
                                        ? "text-[#0a3d7c] dark:text-[#b0cdf5]"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {availableStock > 0 ? `${availableStock} in` : "Out"}
                                  </Badge>
                                </div>
                                <div className="w-20 md:w-28 flex justify-center">
                                  <div className="rounded-md bg-[#e8f1ff] dark:bg-[#0B0F14]/20 border border-[#b0cdf5] dark:border-[#0a3d7c] px-2 py-1">
                                    <div className="text-center text-sm md:text-xl font-black text-[#0d4f9f] dark:text-[#b0cdf5] whitespace-nowrap leading-none">
                                      ₦{product.price.toLocaleString()}
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  onClick={() => navigate("/auth")}
                                  size="sm"
                                  className="group p-0 gap-0 bg-transparent hover:bg-transparent shadow-none whitespace-nowrap w-16 md:w-[88px] h-7 md:h-9 text-[10px] md:text-sm overflow-hidden"
                                >
                                  <span className="h-full flex-1 flex items-center justify-center bg-[#1565C0] text-white group-hover:bg-[#0d4f9f] transition-colors px-2">
                                    Buy
                                  </span>
                                  <span className="h-full flex items-center justify-center bg-[#d5e5ff] dark:bg-[#0B0F14]/30 group-hover:bg-[#b0cdf5] dark:group-hover:bg-[#0B0F14]/45 transition-colors px-2">
                                    <ArrowRight className="h-4 w-4 text-[#0d4f9f] dark:text-[#b0cdf5]" />
                                  </span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {catProducts.length > DEFAULT_VISIBLE && catProducts.length > visibleCount && (
                  <div className="flex justify-center mt-2 md:mt-2">
                    <Button
                      type="button"
                      onClick={() =>
                        setVisibleCountByCategory(prev => {
                          const current = prev[cat.name] ?? DEFAULT_VISIBLE;
                          const next = Math.min(current + LOAD_STEP, catProducts.length);
                          return { ...prev, [cat.name]: next };
                        })
                      }
                      size="sm"
                      className="bg-[#1565C0] hover:bg-[#0d4f9f] text-white px-4 border-2 border-white"
                    >
                      Load More product
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
