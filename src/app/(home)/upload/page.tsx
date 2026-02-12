import type { Metadata } from "next";
import { UploadCard } from "./upload-card";

export const metadata: Metadata = {
  description:
    "Upload a skin PNG and get a copyable /skin url command using MineSkin.",
};

export default function UploadPage() {
  return (
    <main className="px-4 py-12 w-full max-w-[1400px] mx-auto space-y-10">
      <div className="space-y-4 text-center max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Skin Upload
        </h1>
        <p className="text-lg text-muted-foreground">
          Upload a PNG skin and get a copyable /skin url
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6 max-w-5xl mx-auto items-start">
        <UploadCard />
      </div>
    </main>
  );
}
