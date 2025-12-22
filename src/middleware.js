// src/middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;
  
  // Public paths that don't require authentication
  const isPublicPath = path === '/login';
  
  // Get auth state from cookies (we'll set this during login)
  const token = request.cookies.get('auth-token')?.value;
  const userRole = request.cookies.get('user-role')?.value;

  // If user is on public path and is authenticated, redirect to dashboard
  if (isPublicPath && token) {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/facilities', request.url));
    } else if (userRole === 'staff') {
      return NextResponse.redirect(new URL('/staff/members', request.url));
    }
  }

  // If user is not authenticated and trying to access protected routes
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based access control
  if (token && userRole) {
    // Admin trying to access staff routes
    if (path.startsWith('/staff') && userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/facilities', request.url));
    }
    
    // Staff trying to access admin routes
    if (path.startsWith('/admin') && userRole === 'staff') {
      return NextResponse.redirect(new URL('/staff/members', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/staff/:path*',
    '/login'
  ],
}