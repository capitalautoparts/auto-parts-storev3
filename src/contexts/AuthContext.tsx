import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = "cap-auth-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login - in real app, this would call an API
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simple validation
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    // Mock user data
    const mockUser: User = {
      id: `user-${Date.now()}`,
      email,
      firstName: email.split("@")[0],
      lastName: "User",
    };

    setUser(mockUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockUser));
  };

  const register = async (data: RegisterData) => {
    // Mock registration - in real app, this would call an API
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!data.email || !data.password || !data.firstName || !data.lastName) {
      throw new Error("All fields are required");
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    };

    setUser(newUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
