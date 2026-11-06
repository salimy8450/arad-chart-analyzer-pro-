import "./globals.css";

export const metadata = {
  title: "ARAD CHART ANALYZER PRO",
  description: "تحلیل هوشمند نمودار ارزهای دیجیتال"
};

export default function RootLayout({ children }) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}