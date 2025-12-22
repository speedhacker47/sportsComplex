// src/contexts/AuthContext.js
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../app/lib/firebase';
import { useRouter } from 'next/navigation';

// Import js-cookie directly instead of from utility file
import Cookies from 'js-cookie';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Cookie management functions (inline to avoid import issues)
const setAuthCookies = (user) => {
  if (user && user.uid) {
    Cookies.set('auth-token', user.uid, { expires: 7 });
    Cookies.set('user-role', user.role, { expires: 7 });
  }
};

const clearAuthCookies = () => {
  Cookies.remove('auth-token');
  Cookies.remove('user-role');
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch user data from Firestore based on Firebase UID
  const fetchUserData = async (firebaseUser) => {
    try {
      const staffRef = collection(db, 'staff');
      const q = query(staffRef, where('firebaseUid', '==', firebaseUser.uid));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role,
          firstName: userData.firstName,
          lastName: userData.lastName,
          facility: userData.facility,
          active: userData.active,
          userId: userData.userId,
          contactNumber: userData.contactNumber,
          firestoreId: snapshot.docs[0].id
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        if (userData) {
          setUser(userData);
          setAuthCookies(userData);
        } else {
          // User authenticated but not found in staff collection
          await firebaseSignOut(auth);
          setUser(null);
          clearAuthCookies();
        }
      } else {
        setUser(null);
        clearAuthCookies();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in function
  const signIn = async (email, password) => {
    try {
      // Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user data from Firestore
      const userData = await fetchUserData(userCredential.user);
      
      if (!userData) {
        await firebaseSignOut(auth);
        throw new Error('User account not found in system');
      }

      // Check if user is active
      if (userData.active === false) {
        await firebaseSignOut(auth);
        throw new Error('Your account has been deactivated. Please contact admin.');
      }

      setUser(userData);

      // Set auth cookies
      setAuthCookies(userData);

      // Redirect based on role
      if (userData.role === 'admin') {
        router.push('/admin/facilities');
      } else if (userData.role === 'staff') {
        router.push('/staff/members');
      }

      return { success: true, user: userData };
    } catch (error) {
      console.error('Sign in error:', error);
      
      // Handle specific error messages
      let errorMessage = 'Failed to sign in. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      clearAuthCookies();
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}