import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { InstallProvider } from "@/components/InstallPrompt";
import "./globals.css";

// Applies a persisted theme choice to <html> before the page paints, so
// switching back to dark (or a first load that's already been set to
// dark) never flashes the light default first. Runs before hydration;
// ThemeProvider's own mount effect just keeps React state in sync with
// whatever this already set.
const themeInitScript = `(function(){try{var t=localStorage.getItem("lumen-theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Lumen — Territory Decision Engine",
  description: "Upload your monthly sales export, get territory-level decisions.",
  // manifest.ts (this directory) is auto-linked by Next.js's own file
  // convention, but iOS Safari specifically only honors these apple-*
  // tags for "Add to Home Screen" — it ignores the Web Manifest spec
  // (start_url, display: standalone, icons) almost entirely.
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "Lumen",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#121a38",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ServiceWorkerRegister />
        <ThemeProvider>
          <LanguageProvider>
            <InstallProvider>{children}</InstallProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
