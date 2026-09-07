import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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

type Payment = {
  _id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string;
  createdAt?: string;
  user?: { email?: string };
  email?: string; // For localStorage users
  userLocalId?: string; // For localStorage users
};

export default function PaymentsTable({ token }: { token: string }) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [searchEmail, setSearchEmail] = useState("");

  const fetchPayments = () => {
    setLoading(true);
    setError(null);
  apiFetch("/api/payments", { headers: { Authorization: `Bearer ${token}` } })
      .then((data) => {
        if (Array.isArray(data)) {
          setPayments(data);
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
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDeleteClick = (payment: Payment) => {
    setPaymentToDelete(payment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!paymentToDelete) return;

    try {
      await apiFetch(`/api/payments/${paymentToDelete._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      toast({
        title: "Payment deleted",
        description: `Payment ${paymentToDelete.reference || paymentToDelete._id} has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
      fetchPayments();
    } catch (err) {
      toast({
        title: "Error",
        description: String(err),
        variant: "destructive",
      });
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-600">Loading payments...</div>;
  if (error) return <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">Error: {error}</div>;
  if (!payments || payments.length === 0) return <div className="p-4 text-center text-gray-600">No payments found.</div>;

  // Filter payments based on search email
  const filteredPayments = searchEmail
    ? payments.filter((p) => {
        const userEmail = p.user?.email || p.email || "";
        return userEmail.toLowerCase().includes(searchEmail.toLowerCase());
      })
    : payments;

  return (
    <div className="space-y-4">
      <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]">
        Payments ({filteredPayments.length}{searchEmail ? ` of ${payments.length}` : ''})
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
            className="text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        )}
      </div>

      {filteredPayments.length === 0 ? (
        <div className="p-8 text-center text-gray-600 bg-gray-50 dark:bg-black rounded-xl border-2 border-gray-200 dark:border-gray-800">
          No payments found{searchEmail ? ` for "${searchEmail}"` : ""}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-800">
          <table className="w-full table-auto border-collapse min-w-[700px]">
            <thead className="bg-gradient-to-r from-[#e8f1ff] to-[#e8f1ff] dark:from-[#0B0F14]/30 dark:to-[#0B0F14]/30">
              <tr className="text-left">
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Reference</th>
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">User</th>
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Amount</th>
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Method</th>
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Status</th>
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Date</th>
                <th className="p-3 md:p-4 text-sm md:text-base text-gray-700 dark:text-gray-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => {
              // Get user email from either populated user object or direct email field
              const userEmail = p.user?.email || p.email || "—";
              // Normalize status to lowercase for comparison
              const statusLower = p.status.toLowerCase();
              const statusDisplay = statusLower === 'completed' ? 'Complete' : 
                                   statusLower === 'pending' ? 'Pending' : 
                                   p.status;
              
              return (
                <tr key={p._id} className="border-t border-gray-200 dark:border-gray-800 hover:bg-[#e8f1ff]/50 dark:hover:bg-[#18181b]/50 transition-colors">
                  <td className="p-3 md:p-4 text-xs md:text-sm text-gray-800 dark:text-gray-200 font-mono break-all">{p.reference}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200">{userEmail}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200 font-semibold">₦{p.amount.toFixed(2)}</td>
                  <td className="p-3 md:p-4 text-sm md:text-base text-gray-800 dark:text-gray-200 capitalize">{p.method}</td>
                  <td className="p-3 md:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      statusLower === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 
                      statusLower === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' : 
                      'bg-gray-100 text-gray-700 dark:bg-[#09090b] dark:text-gray-400'
                    }`}>
                      {statusDisplay}
                    </span>
                  </td>
                  <td className="p-3 md:p-4 text-xs md:text-sm text-gray-800 dark:text-gray-200">{p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}</td>
                  <td className="p-3 md:p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(p)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Delete Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment record?
              {paymentToDelete && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-[#09090b] rounded text-sm">
                  <div><strong>Reference:</strong> {paymentToDelete.reference || paymentToDelete._id}</div>
                  <div><strong>Amount:</strong> ₦{paymentToDelete.amount.toFixed(2)}</div>
                  <div><strong>User:</strong> {paymentToDelete.user?.email || paymentToDelete.email || "—"}</div>
                </div>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
