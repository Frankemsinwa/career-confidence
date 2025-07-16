
'use client';

import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupabase } from '@/contexts/supabase-auth-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import React from 'react';

const signUpSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
});
type SignUpValues = z.infer<typeof signUpSchema>;

const signInSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});
type SignInValues = z.infer<typeof signInSchema>;


interface AuthFormTabProps {
    form: UseFormReturn<any>;
    onSubmit: (values: any) => Promise<void>;
    isLoading: boolean;
    buttonText: string;
    isSignUp?: boolean;
}

const AuthFormFields: React.FC<AuthFormTabProps> = ({ form, onSubmit, isLoading, buttonText }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="••••••••" {...field} type="password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {buttonText}
        </Button>
      </form>
    </Form>
);

const GoogleIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        <path fill="none" d="M1 1h22v22H1z"/>
    </svg>
);


export function AuthForm() {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const signInForm = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleSignIn = async (values: SignInValues) => {
    if (!supabase) return;
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: error.message,
      });
    } else {
      toast({
        title: 'Signed In Successfully',
        description: 'Redirecting to your dashboard...',
      });
      router.push('/dashboard');
      router.refresh();
    }
    setIsLoading(false);
  };
  
  const handleSignUp = async (values: SignUpValues) => {
    if (!supabase) return;
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`
        }
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message,
      });
    } else if (data.user && data.user.identities?.length === 0) {
        toast({
            title: 'Sign Up Successful (Action Required)',
            description: 'Please check your email to verify your account. It may already be in use.',
            duration: 7000
        });
    } else {
      toast({
        title: 'Sign Up Successful!',
        description: 'Please check your email to verify your account.',
      });
    }
    setIsLoading(false);
  };

  const handleSignInWithGoogle = async () => {
    if (!supabase) return;
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/api/auth/callback`,
        },
    });

    if (error) {
        toast({
            variant: 'destructive',
            title: 'Google Sign-in Failed',
            description: error.message,
        });
        setIsLoading(false);
    }
    // No need to setIsLoading(false) on success, as the page will redirect.
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">
            Welcome to Career Confidence
          </CardTitle>
          <CardDescription>
            Sign in to continue or sign up to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
                <AuthFormFields
                    form={signInForm}
                    onSubmit={handleSignIn}
                    isLoading={isLoading}
                    buttonText="Sign In"
                />
            </TabsContent>
            <TabsContent value="signup">
                <AuthFormFields
                    form={signUpForm}
                    onSubmit={handleSignUp}
                    isLoading={isLoading}
                    buttonText="Create Account"
                    isSignUp
                />
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignInWithGoogle}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <>
                    <GoogleIcon />
                    Google
                </>
            )}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
