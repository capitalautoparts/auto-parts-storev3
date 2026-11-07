import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { WishlistProvider } from './contexts/WishlistContext';

export function mountCatalog(root: HTMLElement) {
  createRoot(root).render(<StrictMode><AuthProvider disabled><WishlistProvider><App /></WishlistProvider></AuthProvider></StrictMode>);
}
