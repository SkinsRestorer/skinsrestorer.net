import '../style.css'
import PlausibleProvider from "next-plausible";
import {Toaster} from "~/components/ui/sonner";

export default function App({ Component, pageProps }) {
    return (
        <PlausibleProvider trackOutboundLinks trackFileDownloads scriptProps={{"add-file-types": "jar"} as never}
                           domain="skinsrestorer.net">
            <Component {...pageProps} />
            <Toaster richColors />
        </PlausibleProvider>
    )
}
