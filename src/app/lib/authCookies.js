// src/lib/authCookies.js
import Cookies from 'js-cookie';

export const setAuthCookies = (user) => {
  if (user && user.uid) {
    // Set cookies with 7 days expiration
    Cookies.set('auth-token', user.uid, { expires: 7 });
    Cookies.set('user-role', user.role, { expires: 7 });
  }
};

export const clearAuthCookies = () => {
  Cookies.remove('auth-token');
  Cookies.remove('user-role');
};

export const getAuthToken = () => {
  return Cookies.get('auth-token');
};

export const getUserRole = () => {
  return Cookies.get('user-role');
};