import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/pics (2).png";

const Footer = () => {
  return (
    <footer className="mt-6 px-4 md:px-8 pb-6">
      <div className="mx-auto max-w-7xl bg-white/80 backdrop-blur-md border border-gray-100 dark:border-gray-800 dark:bg-black/80 rounded-2xl shadow-sm transition-all duration-300">
        <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2" aria-label="Home">
            <img src={logo} alt="Social Media Marketplace" className="h-10 w-auto max-w-[210px] object-contain" />
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" className="text-[#1565C0]">
              <Link to="/">Home</Link>
            </Button>
            <Button asChild variant="ghost" className="text-[#1565C0]">
              <Link to="/faq">FAQ</Link>
            </Button>
            <Button asChild variant="ghost" className="text-[#1565C0]">
              <Link to="/rules">Rules</Link>
            </Button>
          </nav>
        </div>

        <div className="grid gap-6 border-t border-gray-100 px-4 py-6 text-center dark:border-gray-800 md:grid-cols-3 md:text-left md:px-6">
          <div><p className="text-sm font-black text-[#0B0F14] dark:text-white">Social Media Marketplace</p><p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">Trusted digital services for creators, marketers, and growing brands.</p></div>
          <div><p className="text-xs font-black uppercase tracking-wider text-[#1565C0]">Explore</p><p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Accounts · Lines · Numbers · Support</p></div>
          <div className="md:text-right"><p className="text-xs font-black uppercase tracking-wider text-[#1565C0]">Need help?</p><p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Available every day through our online agent.</p></div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-500 md:col-span-3">© 2026 Social Media Marketplace. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
