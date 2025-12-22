// src/app/layout.js
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata = {
  title: 'Sports Complex',
  description: 'Stadium booking and management system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}