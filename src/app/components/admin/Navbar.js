// src/app/components/admin/Navbar.js
'use client';

import { useRouter } from 'next/navigation';

export default function AdminNavbar() {
  const router = useRouter();

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-md border-b">
      <div className="px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-blue-600">Stadium Admin</h1>
            <div className="hidden md:flex space-x-1">
              <NavLink href="/dashboard/admin/facilities">Facilities</NavLink>
              <NavLink href="/dashboard/admin/bookings">Bookings</NavLink>
              <NavLink href="/dashboard/admin/receptionists">Receptionists</NavLink>
              <NavLink href="/dashboard/admin/analytics">Analytics</NavLink>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full">
              <span className="text-xl">🔔</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                A
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-gray-800">Admin User</p>
                <p className="text-xs text-gray-500">admin@stadium.com</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition font-medium"
    >
      {children}
    </a>
  );
}