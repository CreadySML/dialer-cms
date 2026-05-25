import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata = {
  title: "LMS Dialer Dashboard",
  description: "Lead Management System for call center / dialer operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
