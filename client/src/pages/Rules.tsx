import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";

const Rules = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <Navbar />
      
      <div className="container mx-auto px-4 py-24 md:py-28 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-6 hover:bg-gray-100 dark:hover:bg-[#18181b]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="bg-white/90 dark:bg-black/90 backdrop-blur-xl shadow-xl border border-gray-200 dark:border-gray-800">
          <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-[#1565C0] dark:from-green-400 dark:to-[#4d9cff]">
                RULES @ Social Media Marketplace
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p className="font-medium">
              These rules help establish clear guidelines and conditions for customers purchasing accounts in our store. It is important that customers are aware of all terms and conditions before making a purchase to avoid misunderstandings and conflicts in the future.
            </p>
            <p>
              When buying a product on the Social Media Marketplace website, you automatically agree to the following rules:
            </p>

            <div className="space-y-4">
              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Warranty Period</h3>
                <p>The warranty on the product is 30 minutes from the date of purchase, subject to compliance with all rules and conditions for working with accounts. This means that if you experience problems with your account within the first 30 minutes after purchase and you have followed all instructions and rules, Social Media Marketplace guarantees a replacement or a refund.</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">No Returns for Valid Accounts</h3>
                <p>A purchased valid item cannot be returned or replaced. If you purchased an account that is valid and functional but later changed your mind, Social Media Marketplace will not provide a return or replacement. Please read the product description carefully before purchasing.</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Refund When Replacement Is Not Possible</h3>
                <p>If accounts cannot be replaced, Social Media Marketplace will refund the amount paid. This applies in situations where accounts cannot be replaced for any reason (for example, if they are deleted or blocked).</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Account Security Responsibility</h3>
                <p>If you plan to use purchased accounts for a long time, you must regularly change passwords and take responsibility for account security. Social Media Marketplace is not responsible for any security-related issues after purchase.</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Product Description Awareness</h3>
                <p>Before buying, carefully read the product description and check its characteristics to ensure it meets your needs. Social Media Marketplace provides detailed product descriptions, and customers are responsible for reviewing them before purchase.</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Technical Support</h3>
                <p>If you experience any problems with your order, contact Social Media Marketplace technical support as soon as possible. Technical support responds within 24 hours of contact.</p>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">No Training or Usage Consultation</h3>
                <p>Social Media Marketplace does not provide training or advice on how to use accounts. The store is only responsible for providing operational accounts and does not offer guidance on usage. For usage-related questions, please consult external resources or experts.</p>
              </section>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recommendations for Safe and Efficient Account Usage</h2>
              
              <div className="space-y-4">
                <div className="bg-[#e8f1ff] dark:bg-[#0B0F14]/20 p-4 rounded-lg border border-[#d5e5ff] dark:border-[#0a3d7c]">
                  <h4 className="font-bold text-[#0a3d7c] dark:text-[#8fb5e8] mb-2">Use High-Quality Proxy Servers</h4>
                  <p className="mb-2"><span className="font-semibold">Problem:</span> Logging into multiple accounts from the same IP address can result in all accounts being blocked.</p>
                  <p><span className="font-semibold">Solution:</span> Use high-quality proxy servers such as individual IPv4 or residential proxies. Avoid package proxies and browser extensions like Hola, FreeVPN, etc. Using IPv6 proxies is also not recommended.</p>
                </div>

                <div className="bg-[#e8f1ff] dark:bg-[#0B0F14]/20 p-4 rounded-lg border border-[#d5e5ff] dark:border-[#0a3d7c]">
                  <h4 className="font-bold text-[#0a3d7c] dark:text-[#8fb5e8] mb-2">Use Different Devices for Different Accounts</h4>
                  <p className="mb-2"><span className="font-semibold">Problem:</span> Logging into multiple accounts from the same device (computer, phone, tablet) can lead to account blocks.</p>
                  <p><span className="font-semibold">Solution:</span> Use different devices or specialized software/services for each account. Regular browser windows, incognito mode, or clearing cookies do not count as different devices.</p>
                  <div className="mt-2">
                    <p className="font-semibold mb-1">What Counts as Different Devices:</p>
                    <ul className="list-disc list-inside pl-2 space-y-1 text-sm">
                      <li>Computer and second computer</li>
                      <li>Phone and second phone</li>
                      <li>Profile programs for logging into accounts</li>
                      <li>Changing User-Agent in the browser and other browser-level modifications</li>
                      <li>Using specialized browsers that automatically alter device fingerprints</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-100 dark:border-orange-800">
                  <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">Observe Limits and Human-Like Behavior</h4>
                  <p className="mb-2"><span className="font-semibold">Problem:</span> Immediate aggressive activity (mass likes, mass messaging, etc.) can quickly lead to account blocks.</p>
                  <p><span className="font-semibold">Solution:</span> Begin with natural user behavior such as filling out a profile, subscribing to a few users, liking posts, adding photos, reposting, and commenting gradually.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-100 dark:bg-[#09090b] rounded-lg text-sm text-gray-600 dark:text-gray-400 italic">
              <span className="font-bold not-italic">Important Notice:</span> Social Media Marketplace is not responsible for third-party developers of programs, services, or proxy providers. All accounts registered by Social Media Marketplace or its partners are created using private software, programs that are not available to the public, and proxy servers.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Rules;
