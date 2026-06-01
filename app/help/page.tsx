import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { getCmsValue } from "@/lib/cms";
import { absoluteUrl } from "@/lib/site";
import { FaqAccordion, type Faq } from "./FaqAccordion";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Help & Contact",
  description: "Questions, orders, returns — we're here.",
  alternates: { canonical: absoluteUrl("/help") },
};

const DEFAULT_FAQ: Faq[] = [
  {
    q: "When will my order arrive?",
    a: "Orders are made to order and dispatched within 2–7 business days. UK delivery is 2–4 business days after dispatch; international takes longer. Tracking is emailed automatically.",
  },
  {
    q: "How do returns work?",
    a: "You have 30 days from delivery to request a return or exchange on unworn items. Start it from your account or by replying to your confirmation email.",
  },
  {
    q: "Do you ship internationally?",
    a: "Yes. International orders may be subject to import VAT or duty charged by your own country on delivery — those are set by your local customs.",
  },
  {
    q: "How is my order made?",
    a: "Everything is printed to order by our fulfilment partners, so each piece is made fresh when you buy it. No overproduction, less waste.",
  },
];

export default async function Help() {
  const data = await getCmsValue<{ items: Faq[] }>("faq");
  const faq = Array.isArray(data?.items) && data.items.length ? data.items : DEFAULT_FAQ;

  return (
    <Container className="py-16">
      <h1 className="font-display text-display-2 font-semibold tracking-tight text-deep-ink">
        Help &amp; Contact
      </h1>
      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-body text-[16px] font-bold text-deep-ink">Get in touch</h2>
          <p className="mt-2 mb-6 font-body text-body text-ink/70">
            Questions about an order, a return, or sizing? Send us a note and we&apos;ll come back
            to you.
          </p>
          <ContactForm />
        </div>
        <div>
          <h2 className="font-body text-[16px] font-bold text-deep-ink">Frequently asked</h2>
          <div className="mt-4">
            <FaqAccordion items={faq} />
          </div>
        </div>
      </div>
    </Container>
  );
}
