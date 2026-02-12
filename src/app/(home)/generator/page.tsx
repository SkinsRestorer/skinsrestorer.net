import type { Metadata } from "next";
import { GenerateFileCard, ReverseFileCard } from "./generator-card";

export const metadata: Metadata = {
  description:
    "Generate copyable /sr createcustom commands or reverse existing skin files.",
};

export default function GeneratorPage() {
  return (
    <main className="px-4 py-12 w-full max-w-[1400px] mx-auto space-y-10">
      <div className="space-y-4 text-center max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Custom Skin Generator
        </h1>
        <p className="text-lg text-muted-foreground">
          Upload a PNG skin to get an in-game{" "}
          <code className="highlight-code">/sr createcustom</code> command or
          reverse existing custom skin files
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6 max-w-5xl mx-auto items-start">
        <GenerateFileCard />
        <ReverseFileCard />
      </div>
    </main>
  );
}
