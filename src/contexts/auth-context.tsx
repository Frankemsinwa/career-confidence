
'use client';

import { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut, User } from 'firebase/auth';
import { auth, FIREBASE_CONFIG_ERROR } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error: Error | undefined;
  logout: () => Promise<void>;
  firebaseError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  useEffect(() => {
    setFirebaseError(FIREBASE_CONFIG_ERROR);
  }, []);

  const router = useRouter();
  
  // This is the main change: We check for the error *before* calling the hook.
  if (firebaseError) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Alert variant="destructive" className="max-w-2xl">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Firebase Configuration Error</AlertTitle>
              <AlertDescription>
                <p className="mb-4">{firebaseError}</p>
                <p>Please create or update your <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">.env.local</code> file in the root directory with your Firebase project credentials. You can copy the format from <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">.env.local.example</code>.</p>
                <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
{`NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id`}
                </pre>
                <p className="mt-4">After creating or updating the file, you must restart the development server for the changes to take effect.</p>
                 <Button onClick={() => window.location.reload()} className="mt-4">
                    I've updated my .env.local file. Reload the app.
                </Button>
              </AlertDescription>
            </Alert>
        </div>
    );
  }

  // The hook is now inside a component that only renders if there's no error.
  const AuthProviderWithHook = ({ children }: { children: ReactNode }) => {
    const [user, loading, error] = useAuthState(auth);
    
    const logout = async () => {
      await signOut(auth);
      router.push('/login');
    };

    const value = { user, loading, error, logout, firebaseError: null };

    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
  };
  
  return <AuthProviderWithHook>{children}</AuthProviderWithHook>;
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
