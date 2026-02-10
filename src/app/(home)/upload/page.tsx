import type { Metadata } from "next";
import { UploadCard } from "./upload-card";

export const metadata: Metadata = {
  description:
    "Upload a skin PNG and get a copyable /skin url command using MineSkin.",
};

export default function UploadPage() {
  return (
    <main className="px-4 py-12 w-full max-w-[1400px] mx-auto">
      <div className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-4">
          Skin Upload
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Upload a PNG skin and get a copyable /skin url
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6 max-w-5xl mx-auto items-start">
        <UploadCard />
      </div>
    </main>
  );
}
