'use client';

import { GraduationCap, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useSupabase } from '@/contexts/supabase-auth-context';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { supabase, user } = useSupabase();
  const router = useRouter();

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/');
    }
  };

  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <GraduationCap size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Career Confidence</h1>
        </Link>
        {user && (
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="hover:bg-primary/90">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        )}
      </div>
    </header>
  );
}
