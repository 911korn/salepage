import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { PromptPayDemo } from "@/components/landing/promptpay-demo";
import { Features } from "@/components/landing/features";
import { StorefrontPreview } from "@/components/landing/storefront-preview";
import { Pricing } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <PromptPayDemo />
        <Features />
        <StorefrontPreview />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
