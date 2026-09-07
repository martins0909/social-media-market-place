import Navbar from "@/components/Navbar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FAQ_ITEMS = [
  {
    q: "What is Social Media Marketplace?",
    a: "Social Media Marketplace is a digital product marketplace where you can browse categories, check stock and price, and purchase available items from your account dashboard.",
  },
  {
    q: "How do I find a product quickly?",
    a: "Use the search icon on the Navbar to search by product name. You can also use the Select Category dropdown to jump straight to a category on the home page.",
  },
  {
    q: "Why does a product show 'Out' in stock?",
    a: "It means there are currently no available units left for that product. Stock updates automatically when new units are added.",
  },
  {
    q: "How do I buy a product?",
    a: "Tap the Buy button on a product. If you are not signed in, you will be redirected to sign in first.",
  },
  {
    q: "Where do I see my purchases?",
    a: "After payment, your purchased details will be available inside your dashboard / order history section.",
  },
  {
    q: "What if I have an issue with an order?",
    a: "Please contact support as soon as possible and include your order reference. The fastest way is to use the support links on the website.",
  },
  {
    q: "Do you offer refunds?",
    a: "Refund/replacement depends on the product rules and warranty window. Please review the Rules page for the current policy.",
  },
];

export default function Faq() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <Navbar />

      <div className="container mx-auto px-4 py-24 md:py-28 max-w-4xl">
        <Card className="bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-xl border border-gray-200 dark:border-gray-800">
          <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-6">
            <CardTitle className="text-2xl md:text-3xl font-bold text-[#0d4f9f] dark:text-[#8fb5e8]">
              FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger className="text-left text-gray-900 dark:text-gray-100">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
