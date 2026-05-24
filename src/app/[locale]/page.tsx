import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { PromptPayDemo } from "@/components/landing/promptpay-demo";
import { Features } from "@/components/landing/features";
import { StorefrontPreview } from "@/components/landing/storefront-preview";
import { Pricing } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { auth } from "@/lib/auth";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  return (
    <>
      <Navbar signedIn={Boolean(session?.user)} />
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
