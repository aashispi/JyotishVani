// app/page.tsx
import JyotishChat from "@/components/JyotishChat";

export const metadata = {
  title: "Jyotish GPT — BPHS Scholar",
  description: "Ask questions about Vedic astrology texts in English or any Indian language.",
};

export default function Home() {
  return <JyotishChat />;
}
