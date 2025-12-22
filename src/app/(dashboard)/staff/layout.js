// src/app/(dashboard)/staff/layout.js
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import StaffSidebar from '@/app/components/staff/Sidebar';

export default function StaffLayout({ children }) {
  const { user, loading, isStaff } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (!isStaff) {
        router.push('/admin/facilities');
      }
    }
  }, [user, loading, isStaff, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isStaff) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}