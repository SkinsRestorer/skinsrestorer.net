import Link from "fumadocs-core/link";
import { Button } from "@/components/ui/button";

export default function RootComponent() {
  return (
    <main className="px-4 py-12 w-full max-w-[1400px] mx-auto flex my-auto">
      <meta name="robots" content="noindex" />
      <div className="flex flex-col m-auto gap-4">
        <h1 className="text-3xl font-bold text-center">404 - Page not found</h1>
        <div className="mx-4">
          <img
            src="/nyan-cat.webp"
            alt="Nyan Cat"
            width={500}
            height={500}
            className="rounded-xl"
          />
        </div>
        <Button
          render={
            <Link href="/" className="w-fit m-auto">
              <span>Go back</span>
            </Link>
          }
          nativeButton={false}
        />
      </div>
    </main>
  );
}
