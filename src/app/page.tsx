import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeatureTrio } from "@/components/landing/feature-trio";
import { Pricing } from "@/components/landing/pricing";
import { SiteFooter } from "@/components/landing/site-footer";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <div aria-hidden className="h-0.5 w-full bg-signal" />
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <FeatureTrio />
        <Pricing />
      </main>
      <SiteFooter />
    </div>
  );
}
