import { Banner } from "fumadocs-ui/components/banner";
import { defineI18nUI } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { Toaster } from "@/components/ui/sonner";
import { i18n } from "@/lib/i18n";

const { provider } = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: "English",
    },
    de: {
      displayName: "Deutsch",
      search: "Dokumentation durchsuchen",
    },
  },
});

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function LangLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;

  return (
    <RootProvider i18n={provider(lang)}>
      {/*
      <Banner id="upload-now-website">
        You can now upload skin .png files here!
      </Banner>
      */}
      {children}
      <Toaster richColors />
      <CookieConsentBanner />
    </RootProvider>
  );
}
