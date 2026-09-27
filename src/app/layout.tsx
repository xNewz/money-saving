import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "@/index.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

const prompt = Prompt({ 
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["latin", "thai"],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: "เก็บหอม - ผู้ช่วยจัดการเงินของคุณ",
  description: "แอปพลิเคชันบันทึกรายรับรายจ่ายและจัดการเงินส่วนบุคคล",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${prompt.variable} font-sans`}>
        <ThemeProvider defaultTheme="system" storageKey="money-saving-theme">
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
