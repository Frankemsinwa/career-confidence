
'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut, User } from 'firebase/auth';
import { auth, FIREBASE_CONFIG_ERROR } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthContextType {
  user: User | null | undefined;
  loading: boolean;
  error: Error | undefined;
  logout: () => Promise<void>;
  firebaseError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// This is a separate component that can safely use the auth hook
// because it will only be rendered when we know `auth` is valid.
function AuthProviderWithHook({ children }: { children: ReactNode }) {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    router.push('/login');
  };

  const value = { user, loading, error, logout, firebaseError: null };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


export function AuthProvider({ children }: { children: ReactNode }) {
  // If there's a configuration error, show the error message and stop.
  // This prevents the rest of the app from trying to use Firebase hooks with an invalid instance.
  if (FIREBASE_CONFIG_ERROR) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Alert variant="destructive" className="max-w-2xl">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Firebase Configuration Error</AlertTitle>
              <AlertDescription>
                <p className="mb-4">{FIREBASE_CONFIG_ERROR}</p>
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
  
  // If there is no error, we can safely render the component that uses the hooks.
  return <AuthProviderWithHook>{children}</AuthProviderWithHook>;
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
