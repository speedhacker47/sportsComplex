// src/app/(dashboard)/layout.js
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Development mode - check localStorage
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    // Development mode - clear localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <main className=" mx-auto">
        {children}
      </main>
    </div>
  );
}