import { GraduationCap } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap size={32} />
          <h1 className="text-2xl font-bold tracking-tight">Career Confidence</h1>
        </Link>
      </div>
    </header>
  );
}
