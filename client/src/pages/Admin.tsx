import { Button } from "@/components/ui/button";
import AdminLogin from "@/components/admin/AdminLogin";
import UsersTable from "../components/admin/UsersTable";
import PaymentsTable from "../components/admin/PaymentsTable";
import CartsTable from "../components/admin/CartsTable";
import { useEffect, useState } from "react";
import AdminCatalog from "@/components/admin/AdminCatalog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X, Users, CreditCard, History, Package, LogOut } from "lucide-react";

const Admin = () => {
  // Read token on mount to avoid SSR/window issues
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<"users" | "payments" | "carts" | "catalog">("users");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // initialize token from localStorage once on mount
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("admin_token");
      if (t) setToken(t);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem("admin_token", token);
    else localStorage.removeItem("admin_token");
  }, [token]);

  const handleViewChange = (newView: "users" | "payments" | "carts" | "catalog") => {
    setView(newView);
    setMobileMenuOpen(false);
  };

  return (
    <main className="min-h-screen p-3 md:p-8 bg-gray-50 dark:bg-black transition-colors duration-300">
      <header className="bg-white/90 dark:bg-black/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-xl border-2 border-white/60 dark:border-gray-800 mb-4 md:mb-8">
        {/* Mobile Header */}
        <div className="flex items-center justify-between md:hidden">
          <h1 
            className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]"
            style={{ fontFamily: 'Poppins, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}
          >
            Admin Dashboard
          </h1>
          {token && (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="dark:text-gray-300"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <h1 
            className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1565C0] to-[#0d4f9f] dark:from-[#4d9cff] dark:to-[#1565C0]"
            style={{ fontFamily: 'Poppins, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}
          >
            Admin Dashboard
          </h1>
          {token && (
            <div className="flex items-center gap-4">
              <nav className="flex gap-2">
                <Button 
                  variant={view === "users" ? "default" : "ghost"} 
                  onClick={() => setView("users")}
                  className={view === "users" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </Button>
                <Button 
                  variant={view === "payments" ? "default" : "ghost"} 
                  onClick={() => setView("payments")}
                  className={view === "payments" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payments
                </Button>
                <Button 
                  variant={view === "carts" ? "default" : "ghost"} 
                  onClick={() => setView("carts")}
                  className={view === "carts" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}
                >
                  <History className="h-4 w-4 mr-2" />
                  Buy History
                </Button>
                <Button 
                  variant={view === "catalog" ? "default" : "ghost"} 
                  onClick={() => setView("catalog")}
                  className={view === "catalog" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Catalog
                </Button>
              </nav>
              <ThemeToggle />
              <Button 
                variant="ghost" 
                onClick={() => setToken(null)} 
                aria-label="Logout"
                className="hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-950 dark:hover:text-red-400 transition-all duration-300"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        {token && mobileMenuOpen && (
          <nav className="md:hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <Button 
              variant={view === "users" ? "default" : "ghost"} 
              onClick={() => handleViewChange("users")}
              className={`w-full justify-start ${view === "users" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}`}
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </Button>
            <Button 
              variant={view === "payments" ? "default" : "ghost"} 
              onClick={() => handleViewChange("payments")}
              className={`w-full justify-start ${view === "payments" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}`}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Payments
            </Button>
            <Button 
              variant={view === "carts" ? "default" : "ghost"} 
              onClick={() => handleViewChange("carts")}
              className={`w-full justify-start ${view === "carts" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}`}
            >
              <History className="h-4 w-4 mr-2" />
              Buy History
            </Button>
            <Button 
              variant={view === "catalog" ? "default" : "ghost"} 
              onClick={() => handleViewChange("catalog")}
              className={`w-full justify-start ${view === "catalog" ? "bg-[#1565C0] hover:bg-[#0d4f9f]" : "dark:text-gray-300 dark:hover:bg-[#18181b]"}`}
            >
              <Package className="h-4 w-4 mr-2" />
              Catalog
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setToken(null)} 
              className="w-full justify-start hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-red-950 dark:hover:text-red-400 transition-all duration-300"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        )}
      </header>

      {!token ? (
        <AdminLogin onLogin={(t) => setToken(t)} />
      ) : (
        <section className="bg-white/90 dark:bg-black/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-xl border-2 border-white/60 dark:border-gray-800">
          {view === "users" && <UsersTable token={token} />}
          {view === "payments" && <PaymentsTable token={token} />}
          {view === "carts" && <CartsTable token={token} />}
          {view === "catalog" && <AdminCatalog />}
        </section>
      )}
    </main>
  );
};

export default Admin;
