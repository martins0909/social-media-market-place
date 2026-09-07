import { useEffect, useState } from "react";
import { purchaseHistoryAPI, type PurchaseHistory as ApiPurchaseHistory } from "@/lib/api";
import { Search, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Align with API type to avoid mismatches
type PurchaseHistory = ApiPurchaseHistory;

export default function CartsTable({ token }: { token: string }) {
  const [purchases, setPurchases] = useState<PurchaseHistory[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHistory | null>(null);

  async function loadData(emailFilter?: string) {
    setLoading(true);
    setError(null);
    try {
  const data = await purchaseHistoryAPI.getAll(emailFilter);
  setPurchases(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    await loadData(searchEmail.trim() || undefined);
    setSearching(false);
  }

  function clearSearch() {
    if (searchEmail.trim().length === 0) return;
    setSearchEmail("");
    loadData();
  }

  if (loading) return <div className="p-4 text-center text-gray-600 dark:text-gray-400">Loading purchase history...</div>;
  if (error) return <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900">Error: {error}</div>;
  if (!purchases || purchases.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-400">
        {searchEmail.trim().length > 0 ? (
          <>No results for <span className="font-semibold">{searchEmail}</span>.</>
        ) : (
          <>No purchase history found.</>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]">
          Buy History ({purchases.length})
        </h2>
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full md:w-64 pl-8 pr-20 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-black text-sm focus:ring-2 focus:ring-[#1565C0] focus:border-[#1565C0] outline-none"
            />
            {searchEmail && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-16 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >Clear</button>
            )}
            <button
              type="submit"
              disabled={searching}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#1565C0] hover:bg-[#0d4f9f] disabled:bg-[#4d9cff] text-white text-sm font-medium px-3 py-1 rounded-md transition-colors"
            >{searching ? 'Searching...' : 'Search'}</button>
          </div>
        </form>
      </div>
      <div className="overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-800">
        <table className="w-full table-auto border-collapse min-w-[700px]">
          <thead className="bg-gradient-to-r from-[#e8f1ff] to-[#e8f1ff] dark:from-[#0B0F14]/30 dark:to-[#0B0F14]/30">
            <tr className="text-left">
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Email</th>
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Product</th>
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Category</th>
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Qty</th>
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Price</th>
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Total</th>
              <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const total = (p.price || 0) * (p.quantity || 0);
              return (
                <tr key={p._id} className="border-t border-gray-200 dark:border-gray-800 hover:bg-[#e8f1ff]/50 dark:hover:bg-[#18181b]/50 transition-colors">
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{p.email || "—"}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                      <span>{p.name || "—"}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-gray-500 hover:text-[#1565C0]" 
                        onClick={() => setSelectedPurchase(p)}
                        title="View Description"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{p.category || "—"}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{p.quantity || 0}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">₦{(p.price || 0).toFixed(2)}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200 font-semibold">₦{total.toFixed(2)}</td>
                  <td className="p-3 md:p-4 text-xs md:text-sm text-gray-800 dark:text-gray-200">{p.purchaseDate ? new Date(p.purchaseDate).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selectedPurchase} onOpenChange={(open) => !open && setSelectedPurchase(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedPurchase?.name}</DialogTitle>
            <DialogDescription>
              Product Description
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex-1 overflow-y-auto">
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {selectedPurchase?.description || "No description available."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
