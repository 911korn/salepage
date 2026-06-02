import { setRequestLocale } from "next-intl/server";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { PromptPayDemo } from "@/components/landing/promptpay-demo";
import { Features } from "@/components/landing/features";
import { StorefrontPreview } from "@/components/landing/storefront-preview";
import { Pricing } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { organizationSchema, websiteSchema } from "@/lib/jsonld-shared";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Combine Organization + WebSite into a JSON-LD @graph so Google parses
  // both with a single inline script. WebSite's potentialAction unlocks the
  // sitelinks search box; Organization fills the knowledge-panel card.
  const ldGraph = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema({ locale: locale === "en" ? "en" : "th" }), websiteSchema()],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldGraph) }}
      />
      {/* Navbar resolves signed-in state client-side (via /api/v1/session)
          so this marketing homepage stays statically prerendered — no
          server-side auth() that would force a function invocation per
          bot/crawler hit. */}
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
