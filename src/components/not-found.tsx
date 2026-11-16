import Link from "fumadocs-core/link";
import { HomeLayout } from "@/components/home-layout";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-react";

export default function RootComponent() {
  const t = useT();
  return (
    <HomeLayout>
      <title>{`${t("common.404PageNotFound")} - SR`}</title>
      <meta name="robots" content="noindex" />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 px-4 py-12">
        <div className="m-auto flex flex-col items-center gap-4">
          <h1 className="text-center text-3xl font-bold">
            {t("common.404PageNotFound")}
          </h1>
          <img
            src="/nyan-cat.webp"
            alt=""
            width={500}
            height={500}
            className="rounded-xl"
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button render={<Link href="/" />} nativeButton={false}>
              {t("common.backHome")}
            </Button>
            <Button
              render={<Link href="/docs" />}
              nativeButton={false}
              variant="outline"
            >
              {t("nav.documentation")}
            </Button>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
}
