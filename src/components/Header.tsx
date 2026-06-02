import Link from 'next/link';
import { ShieldCheck, Camera, Grid3X3, ImageIcon } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Camera className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-primary">PixelPass <span className="text-secondary">AI</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/editor" className="text-sm font-medium hover:text-primary transition-colors">AI Editor</Link>
          <Link href="/grid-maker" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5">
            <Grid3X3 className="h-4 w-4" /> Grid Maker
          </Link>
          <Link href="/gallery" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" /> Gallery
          </Link>
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-muted-foreground border">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            <span>Secure & Private</span>
          </div>
        </nav>
      </div>
    </header>
  );
}