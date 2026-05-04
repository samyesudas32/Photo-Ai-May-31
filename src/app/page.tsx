import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, UserCheck, Zap, Download, Layers, Camera, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/Header';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LandingPage() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-portrait');

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1">
        <section className="relative overflow-hidden py-24 md:py-32">
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="max-w-2xl space-y-8">
                <div className="inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-sm font-medium text-secondary ring-1 ring-inset ring-secondary/20">
                  New: Gemini 2.5 Powered Engine
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                  Official Passport Photos, <span className="text-primary">Perfected by AI.</span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Transform any casual portrait into a professional, government-compliant passport photo in seconds. High resolution, white background, and face alignment — all automated.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="h-14 px-8 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all" asChild>
                    <Link href="/editor">
                      Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold bg-white/50 backdrop-blur" asChild>
                    <Link href="/grid-maker">
                      <Grid3X3 className="mr-2 h-5 w-5" /> Try Grid Maker
                    </Link>
                  </Button>
                </div>
                <div className="flex items-center gap-6 pt-4 text-sm font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> 100% Compliant</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> 4K Resolution</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-500" /> Identity Preserved</span>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-white rounded-[2rem] p-4 shadow-2xl">
                  <div className="overflow-hidden rounded-[1.5rem] bg-muted aspect-[3/2] relative">
                    {heroImage?.imageUrl ? (
                      <Image 
                        src={heroImage.imageUrl} 
                        alt="Before and after passport photo" 
                        fill
                        className="object-cover"
                        data-ai-hint="portrait woman"
                        priority
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white font-bold py-2 px-6 rounded-full shadow-lg border-4 border-white z-20">
                    AI POWERED
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-24 bg-white/50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Precision at every pixel.</h2>
              <p className="text-lg text-muted-foreground italic">Our AI doesn't just filter; it meticulously reconstructs according to global standards.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: UserCheck,
                  title: "Face Alignment",
                  desc: "Automatically detects, centers, and aligns facial features to strict biometric standards."
                },
                {
                  icon: Layers,
                  title: "Background Studio",
                  desc: "Intelligent segmentation replaces any background with a pure, uniformly lit white (#FFFFFF)."
                },
                {
                  icon: Zap,
                  title: "Lighting Correction",
                  desc: "Removes harsh shadows and corrects exposure while preserving your natural identity."
                },
                {
                  icon: CheckCircle2,
                  title: "Grid Generator",
                  desc: "Instantly create 2x4 grids for 4x6 inch photo paper at 300 DPI resolution."
                },
                {
                  icon: ArrowRight,
                  title: "4K Upscaling",
                  desc: "Ensures print-ready quality even from low-resolution source images."
                },
                {
                  icon: Download,
                  title: "Instant Format",
                  desc: "Export in standard PNG or PDF formats ready for professional printing."
                }
              ].map((feature, i) => (
                <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-8 space-y-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg">PixelPass AI</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2024 PixelPass AI. All photos are processed securely and not stored.</p>
            <div className="flex gap-6">
              <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}