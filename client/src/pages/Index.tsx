import Navbar from "@/components/Navbar";
import CategoryBanners from "@/components/CategoryBanners";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const ROTATING_STORE_WORDS = ["Facebook", "Twitter", "VPN", "Instagram", "Tiktok", "Truck update"];

function useTypewriterWords(words: string[]) {
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex] ?? "";

    const isWordComplete = !isDeleting && charIndex >= currentWord.length;
    const isWordEmpty = isDeleting && charIndex <= 0;

    let delay = isDeleting ? 45 : 70;
    if (isWordComplete) delay = 900;
    if (isWordEmpty) delay = 250;

    const timer = window.setTimeout(() => {
      if (isWordComplete) {
        setIsDeleting(true);
        return;
      }

      if (isWordEmpty) {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
        return;
      }

      setCharIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [charIndex, isDeleting, wordIndex, words]);

  const current = words[wordIndex] ?? "";
  return current.slice(0, charIndex);
}

const AnimatedCounter = ({ end, suffix = "", duration = 2000 }: { end: number, suffix?: string, duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setCount(Math.floor(easeOutQuart * end));
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };
    
    animationFrameId = window.requestAnimationFrame(step);
    
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <span>{count}{suffix}</span>;
};

import facebookImg from "@/assets/facebook (2).jpg";
import instagramImg from "@/assets/Instargram.jpg";
import numberImg from "@/assets/number.jpg";
import telegramImg from "@/assets/telegram.jpg";
import tiktokImg from "@/assets/tiktok.jpg";
import whatsappImg from "@/assets/whatsapp.jpg";
import xImg from "@/assets/x.jpg";
import processImage from "@/assets/pics (1).png";
import agentImage from "@/assets/agentworking.jpg";
import complaintImage from "@/assets/getyourcomplain.jpg";
import customerImage from "@/assets/ourcustomer1.jpg";
import { ShoppingBag, Zap, ArrowRight, Wallet, Shield, Globe2, History, Settings, Sparkles, Instagram, Facebook, Music2, Send, CheckCircle2, ChevronDown, Star } from "lucide-react";
import { memo } from "react";

/**
 * Index Page - Social Media Marketplace landing page
 * Modern, semantic, and accessible version without altering the UI.
 */
const Index = () => {
  const navigate = useNavigate();
  const typedStoreWord = useTypewriterWords(ROTATING_STORE_WORDS);

  return (
  <main className="min-h-screen flex flex-col bg-[#f7f9fc] dark:bg-[#0B0F14] relative overflow-hidden transition-colors duration-300">
      {/*  Navbar */}
      <Navbar />

      {/* Social Media Marketplace hero */}
      <section
        id="home"
        aria-label="Social Media Marketplace"
        className="relative flex min-h-[90vh] flex-col overflow-hidden bg-[#0B0F14] pt-32 text-white"
      >
        <div className="pointer-events-none absolute inset-0 z-0 hero-grid opacity-70" />
        <div className="pointer-events-none absolute -right-40 -top-40 z-0 h-[520px] w-[520px] rounded-full bg-[#1565C0]/20 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-52 left-1/4 z-0 h-[420px] w-[420px] rounded-full bg-[#FFC107]/10 blur-[100px]" />
      {/* Popular categories */}
      <section id="popular-categories" className="relative z-30 bg-[#f7f9fc] px-4 py-16 md:px-8 md:py-24 dark:bg-[#0B0F14]">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#1565C0]">Popular Categories</p>
            <h2 className="text-3xl font-black tracking-tight text-[#0B0F14] md:text-5xl dark:text-white">Find the right account for your next move.</h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">Browse our most in-demand product lines. Fresh stock added daily.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {[
              { image: facebookImg, tag: "Hot", title: "Facebook Accounts", desc: "Aged, marketplace-enabled, and ads-ready profiles" },
              { image: instagramImg, tag: "Popular", title: "Instagram Accounts", desc: "Warmed profiles with followers and post history" },
              { image: tiktokImg, tag: "Trending", title: "TikTok Accounts", desc: "Creator fund eligible with organic reach history" },
              { image: whatsappImg, tag: "New", title: "WhatsApp Lines", desc: "Bulk API, business, and personal aged lines" },
              { image: telegramImg, tag: "VIP", title: "Telegram Accounts", desc: "Aged channels, groups, and premium user accounts" },
              { image: xImg, tag: "Premium", title: "X / Twitter", desc: "Verified-ready aged handles with tweet history" },
              { image: numberImg, tag: "Instant", title: "Virtual Numbers", desc: "OTP bypass numbers for verification services" },
              { image: processImage, tag: "Exclusive", title: "Dating Profiles", desc: "Premium setups ready for a fresh start" },
            ].map((category) => (
              <article key={category.title} className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-[#121a24] sm:rounded-2xl">
                <div className="relative h-28 overflow-hidden sm:h-44"><img src={category.image} alt={category.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-2 top-2 rounded-full bg-[#FFC107] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#0B0F14] sm:left-3 sm:top-3 sm:px-3 sm:text-[10px]">{category.tag}</span></div>
                <div className="p-3 sm:p-5"><h3 className="text-sm font-black leading-tight text-[#0B0F14] sm:text-lg dark:text-white">{category.title}</h3><p className="mt-2 min-h-10 text-[11px] leading-relaxed text-gray-600 sm:text-sm dark:text-gray-400">{category.desc}</p><button onClick={() => navigate("/auth")} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#1565C0] transition group-hover:gap-2 sm:mt-5 sm:gap-2 sm:text-sm">Browse <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" /></button></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="relative z-30 bg-white px-4 py-16 md:px-8 md:py-24 dark:bg-[#101820]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]"><div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#0B0F14] p-5"><img src={processImage} alt="Marketplace support workflow" className="h-full min-h-[320px] w-full rounded-2xl object-cover opacity-80" /><div className="absolute bottom-8 left-8 max-w-[220px] rounded-xl border border-white/20 bg-[#0B0F14]/85 p-4 text-white backdrop-blur"><p className="text-2xl font-black text-[#FFC107]">10K+</p><p className="text-xs font-bold uppercase tracking-wider text-white/70">successful deliveries</p></div></div><div><p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#1565C0]">Trusted by Thousands</p><h2 className="text-3xl font-black tracking-tight text-[#0B0F14] md:text-5xl dark:text-white">Built around confidence, speed, and real support.</h2><div className="mt-8 grid gap-4 sm:grid-cols-3">{[{ image: agentImage, label: "Human support" }, { image: complaintImage, label: "Fast resolution" }, { image: customerImage, label: "Happy buyers" }].map((item) => <div key={item.label} className="overflow-hidden rounded-xl border border-gray-200 bg-[#f7f9fc] dark:border-white/10 dark:bg-[#0B0F14]"><img src={item.image} alt={item.label} className="h-24 w-full object-cover" /><p className="p-3 text-xs font-bold text-[#0B0F14] dark:text-white">{item.label}</p></div>)}</div></div></div>
      </section>

      <section className="relative z-30 bg-[#f7f9fc] px-4 py-16 md:px-8 md:py-24 dark:bg-[#0B0F14]"><div className="mx-auto max-w-7xl"><div className="mb-10 text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#1565C0]">What Our Buyers Say</p><h2 className="text-3xl font-black text-[#0B0F14] md:text-5xl dark:text-white">Proof in every delivery.</h2></div><div className="grid gap-5 md:grid-cols-3">{[{ quote: "Best platform I've used for aged Facebook accounts. Delivery was instant and the accounts were already warmed. My ad campaigns were live within minutes.", initial: "A", name: "Adebayo K.", role: "Marketer" }, { quote: "I've been buying bulk WhatsApp and Telegram lines from here for months. The quality is consistent, stock is always available, and support replies fast.", initial: "J", name: "Jessica M.", role: "Reseller" }, { quote: "The wallet system makes everything seamless. I funded once and purchased 20+ accounts without re-entering payment details. Game changer for bulk buyers.", initial: "E", name: "Emeka O.", role: "Affiliate" }].map((testimonial) => <article key={testimonial.name} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121a24]"><div><div className="mb-5 flex gap-1 text-[#FFC107]">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div><p className="text-sm leading-7 text-gray-700 dark:text-gray-300">“{testimonial.quote}”</p></div><div className="mt-7 flex items-center gap-3 border-t border-gray-100 pt-5 dark:border-white/10"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1565C0] font-black text-white">{testimonial.initial}</span><div><p className="text-sm font-black text-[#0B0F14] dark:text-white">{testimonial.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{testimonial.role}</p></div></div></article>)}</div></div></section>

      <section className="relative z-30 bg-white px-4 py-16 md:px-8 md:py-24 dark:bg-[#101820]"><div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[0.8fr_1.2fr]"><div><p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-[#1565C0]">Got Questions?</p><h2 className="text-3xl font-black text-[#0B0F14] md:text-5xl dark:text-white">Frequently Asked</h2><p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-400">Clear answers before you place your first order.</p></div><div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-[#f7f9fc] px-5 dark:divide-white/10 dark:border-white/10 dark:bg-[#0B0F14]">{["How quickly do I receive my purchased accounts?", "What payment methods do you accept?", "Are the accounts safe and verified?", "Can I get a replacement if an account has issues?", "Do you offer bulk purchase discounts?"].map((question) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-[#0B0F14] dark:text-white"><span>{question}</span><ChevronDown className="h-4 w-4 shrink-0 text-[#1565C0] transition group-open:rotate-180" /></summary><p className="mt-3 pr-8 text-sm leading-6 text-gray-600 dark:text-gray-400">Our support team can confirm the latest availability, delivery timing, and account-specific details before or after checkout.</p></details>)}</div></div></section>

      <section className="relative z-30 mx-4 my-10 overflow-hidden rounded-2xl bg-[#0B0F14] px-5 py-7 text-white shadow-xl md:mx-auto md:max-w-7xl md:px-10 md:py-8"><div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#FFC107]">Ready to Get Started?</p><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 md:text-base">Join thousands of satisfied customers. Create your free account, fund your wallet, and start shopping premium logs in under 60 seconds.</p></div><Button onClick={() => navigate("/auth")} className="h-11 shrink-0 bg-[#FFC107] px-6 font-black text-[#0B0F14] hover:bg-[#ffd34d]">Create Free Account <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>

        <div className="absolute -bottom-52 left-1/4 h-[420px] w-[420px] rounded-full bg-[#FFC107]/10 blur-[100px]" />

        <div className="container mx-auto relative z-20 order-first max-w-7xl">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] w-full">
            
            {/* ≡ƒô¥ Hero Text & Content */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 w-full max-w-2xl text-left">
              
              {/* Pill Marquee Badge */}
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-[#FFC107]" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#FFC107]">
                  Built for social growth
                </span>
              </div>

              {/* Headlines */}
              <div className="space-y-6">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-white leading-[1.02]">
                  Social Media <br />
                  <span className="text-[#FFC107]">Marketplace</span>
                  <span className="text-white">.</span>
                  <span className="sr-only"> Buy and sell social media accounts and digital services.</span>
                  {/* Keep the rotating service label alive for the page rhythm. */}
                  <span className="block text-xl sm:text-2xl lg:text-3xl font-semibold text-[#8ea2bd] mt-5">
                    Find your next <span className="text-[#4d9cff]">{typedStoreWord}</span> service.
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-[#c6d0dc] leading-relaxed font-light mt-4 max-w-xl">
                  One focused marketplace for trusted social accounts, digital services, and fast delivery across the platforms you use every day.
                </p>
              </div>

              {/* Call to Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2 w-full">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="h-14 px-8 bg-[#1565C0] hover:bg-[#0d4f9f] text-white font-bold shadow-xl shadow-[#1565C0]/30 transition-all duration-300 transform hover:-translate-y-1 rounded-xl w-full sm:w-auto overflow-hidden relative group border-0 text-lg"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 ease-in-out"></div>
                  <span className="flex items-center gap-2 justify-center relative z-10 text-white dark:text-white">
                    Explore Store
                    <ShoppingBag className="w-5 h-5 ml-1 animate-bounce" style={{ animationDuration: '2s' }} />
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-14 px-8 text-lg font-semibold border border-white/30 hover:border-[#FFC107] bg-white/10 hover:bg-white text-white hover:text-[#0B0F14] backdrop-blur-sm transition-all duration-300 rounded-xl w-full sm:w-auto shadow-sm"
                >
                  Learn More
                </Button>
              </div>
              
              {/* Trust Indicators */}
              <div className="pt-8 flex items-center gap-8 lg:gap-12 border-t border-white/20">
                  <div className="text-center transition-transform hover:-translate-y-1 duration-300 cursor-default">
                    <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md"><AnimatedCounter end={10} suffix="K+" duration={2500} /></p>
                    <p className="text-xs md:text-sm font-bold text-gray-200 dark:text-gray-300 uppercase tracking-widest mt-1 drop-shadow-sm">Accounts Sold</p>
                  </div>
                  <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/50 to-transparent"></div>
                  <div className="text-center transition-transform hover:-translate-y-1 duration-300 cursor-default">
                    <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md"><AnimatedCounter end={100} suffix="%" duration={2000} /></p>
                    <p className="text-xs md:text-sm font-bold text-gray-200 dark:text-gray-300 uppercase tracking-widest mt-1 drop-shadow-sm">Satisfaction</p>
                  </div>
                  <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/50 to-transparent hidden sm:block"></div>
                  <div className="text-center transition-transform hover:-translate-y-1 duration-300 cursor-default hidden sm:block">
                    <p className="text-3xl md:text-4xl font-black text-white drop-shadow-md"><AnimatedCounter end={24} suffix="/7" duration={1500} /></p>
                    <p className="text-xs md:text-sm font-bold text-gray-200 dark:text-gray-300 uppercase tracking-widest mt-1 drop-shadow-sm">Support</p>
                  </div>
              </div>
            </div>

            <div className="relative min-h-[360px] hidden md:block animate-float">
              <div className="absolute inset-8 rounded-[2rem] border border-white/10 bg-white/[0.04] rotate-3" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative grid grid-cols-2 gap-4 w-[min(100%,420px)]">
                  {[
                    { img: instagramImg, label: "Instagram", icon: Instagram, tone: "bg-[#E1306C]" },
                    { img: facebookImg, label: "Facebook", icon: Facebook, tone: "bg-[#1565C0]" },
                    { img: tiktokImg, label: "TikTok", icon: Music2, tone: "bg-[#111820]" },
                    { img: telegramImg, label: "Telegram", icon: Send, tone: "bg-[#229ED9]" },
                  ].map(({ img, label, icon: Icon, tone }, index) => (
                    <div key={label} className={`relative overflow-hidden rounded-2xl border border-white/15 ${index % 2 ? "translate-y-8" : "-translate-y-2"} bg-[#121a24] shadow-2xl`}>
                      <img src={img} alt={`${label} marketplace`} className="h-40 w-full object-cover opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-sm font-bold text-white">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span>
                        {label}
                      </div>
                    </div>
                  ))}
                  <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border-4 border-[#0B0F14] bg-[#FFC107] text-[#0B0F14] shadow-xl rotate-6">
                    <Sparkles className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>





      
      {/* Split Hero Banner Section */}
      <section className="py-12 md:py-16 px-4 md:px-8 relative bg-white dark:bg-[#0B0F14] border-t border-b border-gray-200 dark:border-white/10">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Real-time account delivery",
                desc: "Receive logs details inside your dashboard with fast refresh.",
                icon: <Zap className="w-6 h-6 text-[#1565C0]" />
              },
              {
                title: "Wallet-powered checkout",
                desc: "Add funds to your wallet and complete checkout securely with one click.",
                icon: <Wallet className="w-6 h-6 text-[#1565C0]" />
              },
              {
                title: "Secure sessions",
                desc: "Every checkout session is strongly encrypted to keep your info safe.",
                icon: <Shield className="w-6 h-6 text-[#1565C0]" />
              },
              {
                title: "Country + service selection",
                desc: "Search across different global parameters instantly.",
                icon: <Globe2 className="w-6 h-6 text-[#1565C0]" />
              },
              {
                title: "Clean order history",
                desc: "Always revisit previous orders with perfectly sorted invoice logs.",
                icon: <History className="w-6 h-6 text-[#1565C0]" />
              },
              {
                title: "Total control",
                desc: "Manage your profile, wallet, and settings without hitting technical roadblocks.",
                icon: <Settings className="w-6 h-6 text-[#1565C0]" />
              }
            ].map((feature, i) => (
              <div key={i} className="rounded-xl bg-white dark:bg-[#09090b]/60 border border-gray-200 dark:border-gray-700/50 p-4 md:p-5 flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
                <div className="space-y-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#e8f1ff] dark:bg-[#1565C0]/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-sm md:text-base font-medium text-gray-900 dark:text-white leading-tight">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-[11px] md:text-xs font-normal leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/50 relative z-10 w-full">
                  <button 
                    onClick={() => navigate("/auth")}
                    className="flex justify-between items-center w-full text-[11px] md:text-xs font-medium text-[#1565C0] hover:text-[#0d4f9f] transition-colors group-hover:pr-2 duration-300"
                  >
                    Learn more <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Products and Categories */}
      <div className="px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <Button
            type="button"
            onClick={() => navigate("/?focusSearch=1")}
            variant="outline"
            className="w-full md:max-w-xl mx-auto flex justify-start rounded-full h-11 text-gray-500 dark:text-gray-300"
          >
            Search for products ...
          </Button>
        </div>
      </div>

      <CategoryBanners />

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

      <div className="fixed bottom-8 right-6 z-50">
        <a
          href="https://t.me/+0v09JFhl1sZjYTlk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 group"
          aria-label="Contact us on Telegram"
        >
          <div className="flex items-center justify-center w-14 h-14 bg-[#1565C0] hover:bg-[#0d4f9f] text-white rounded-full shadow-2xl group-hover:scale-110 transition-all duration-300">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-700 bg-white/80 backdrop-blur px-2 py-1 rounded-full shadow">online agent</span>
        </a>
      </div>
    </main>
  );
};

export default memo(Index);