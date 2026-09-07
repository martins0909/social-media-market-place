import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle, Plus, Minus, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type User = {
  _id: string;
  email: string;
  name?: string;
  balance?: number;
  payments?: Array<Record<string, unknown>>;
  createdAt?: string;
};   

export default function UsersTable({ token }: { token: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");

  const fetchUsers = () => {
    setLoading(true);
    setError(null);
  apiFetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setError("Invalid response format");
        }
      })
      .catch((e) => {
        setError(String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    setDeleting(true);
    try {
      await apiFetch(`/api/users/${deleteUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast.success("User deleted successfully");
      setDeleteUserId(null);
      fetchUsers(); // Refresh the list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const handleAdjustBalance = async (type: 'add' | 'subtract') => {
    if (!adjustingUserId || !adjustAmount) return;
    
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setAdjusting(true);
    try {
      const finalAmount = type === 'subtract' ? -amount : amount;
      await apiFetch(`/api/users/${adjustingUserId}/adjust-balance`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount: finalAmount })
      });
      
      toast.success(`₦${amount.toFixed(2)} ${type === 'add' ? 'added to' : 'subtracted from'} user wallet`);
      setAdjustingUserId(null);
      setAdjustAmount("");
      fetchUsers(); // Refresh the list
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust balance");
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-600 dark:text-gray-400">Loading users...</div>;
  if (error) return <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900">Error: {error}</div>;
  if (!users || users.length === 0) return <div className="p-4 text-center text-gray-600 dark:text-gray-400">No users found.</div>;

  // Filter users based on search email
  const filteredUsers = searchEmail
    ? users.filter((u) => u.email.toLowerCase().includes(searchEmail.toLowerCase()))
    : users;

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]">
          Registered Users ({filteredUsers.length}{searchEmail ? ` of ${users.length}` : ''})
        </h2>
        
        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-white dark:bg-black p-3 rounded-lg border-2 border-gray-200 dark:border-gray-800">
          <Search className="w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by user email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {searchEmail && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchEmail("")}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear
            </Button>
          )}
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-black rounded-xl border-2 border-gray-200 dark:border-gray-800">
            No users found{searchEmail ? ` for "${searchEmail}"` : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-800">
            <table className="w-full table-auto border-collapse min-w-[700px]">
              <thead className="bg-gradient-to-r from-[#e8f1ff] to-[#e8f1ff] dark:from-[#0B0F14]/30 dark:to-[#0B0F14]/30">
                <tr className="text-left">
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">ID</th>
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Email</th>
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Name</th>
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Balance</th>
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Adjust Wallet</th>
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Payments</th>
                  <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                <tr key={u._id} className="border-t border-gray-200 dark:border-gray-800 hover:bg-[#e8f1ff]/50 dark:hover:bg-[#18181b]/50 transition-colors">
                  <td className="p-3 md:p-4 text-xs md:text-sm text-gray-800 dark:text-gray-200 font-mono break-all">{u._id}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{u.email}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{u.name || "—"}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200 font-semibold">₦{(u.balance || 0).toFixed(2)}</td>
                  <td className="p-3 md:p-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdjustingUserId(u._id)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/50"
                        title="Add funds"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdjustingUserId(u._id)}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-950/50"
                        title="Subtract funds"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{(u.payments || []).length}</td>
                  <td className="p-3 md:p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteUserId(u._id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border-2 border-white/60 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Are you sure you want to delete this user? This action cannot be undone. All associated payments and carts will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="dark:text-gray-300 dark:hover:bg-[#18181b]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust Balance Dialog */}
      <AlertDialog open={!!adjustingUserId} onOpenChange={(open) => !open && setAdjustingUserId(null)}>
        <AlertDialogContent className="bg-white/95 dark:bg-black/95 backdrop-blur-xl border-2 border-white/60 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-800 dark:text-gray-100">
              Adjust User Wallet Balance
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Enter the amount to add or subtract from the user's wallet. This is for manual cash payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="number"
              placeholder="Enter amount (e.g., 1000)"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="w-full"
              step="0.01"
              min="0"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adjusting} className="dark:text-gray-300 dark:hover:bg-[#18181b]">
              Cancel
            </AlertDialogCancel>
            <div className="flex gap-2">
              <Button
                onClick={() => handleAdjustBalance('subtract')}
                disabled={adjusting || !adjustAmount}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Minus className="h-4 w-4 mr-1" />
                {adjusting ? "Processing..." : "Subtract"}
              </Button>
              <Button
                onClick={() => handleAdjustBalance('add')}
                disabled={adjusting || !adjustAmount}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                {adjusting ? "Processing..." : "Add"}
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
