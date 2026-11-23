import { useSyncExternalStore } from "react";
import { browserStorage, lastLocale, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}

const readLastLocale = () => lastLocale(browserStorage()) ?? null;
const serverLastLocale = () => null;

/**
 * The locale for site links. English-only pages, such as legal text, have no
 * locale in the URL, so their links lead back to the last localized locale
 * the reader used. Prerendered HTML has English links, and the stored locale
 * applies only after hydration, so the markup always matches.
 */
export function useLinkLocale(localizedPage: boolean): Locale {
  const locale = useLocale();
  const last = useSyncExternalStore(
    subscribe,
    readLastLocale,
    serverLastLocale,
  );
  return localizedPage ? locale : (last ?? locale);
}
