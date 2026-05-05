
"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import Image from "next/image";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { ImageIcon, Loader2, Camera, Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GalleryPage() {
  const { user } = useUser();
  const db = useFirestore();

  const processedImagesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(
      collection(db, "users", user.uid, "processed_images"),
      orderBy("createdAt", "desc")
    );
  }, [db, user]);

  const { data: images, isLoading } = useCollection(processedImagesQuery);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900 uppercase">Photo Archive</h1>
            <p className="text-sm text-muted-foreground font-medium tracking-tight">
              PRECISION HD RENDERING • LOSSLESS EXPORT
            </p>
          </div>
          <Button asChild className="rounded-full px-8 font-bold shadow-lg transition-transform hover:scale-105">
            <Link href="/editor">
              <Camera className="mr-2 h-4 w-4" /> New Transformation
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">Indexing Gallery...</p>
          </div>
        ) : !images || images.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-20 text-center border-dashed border-2 bg-gray-50/50">
            <div className="h-24 w-24 rounded-full bg-white shadow-inner flex items-center justify-center mb-8">
              <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
            </div>
            <h3 className="text-2xl font-black mb-4 tracking-tight">EMPTY ARCHIVE</h3>
            <p className="text-muted-foreground max-w-sm mb-8 font-medium italic">
              You haven't processed any passport photos yet. Your history will appear here with print-sheet precision.
            </p>
            <Button asChild variant="outline" className="rounded-full px-12 border-2 font-bold">
              <Link href="/editor">Launch AI Editor</Link>
            </Button>
          </Card>
        ) : (
          <div 
            className="grid"
            style={{ 
              display: 'grid',
              gap: '0.52cm',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              boxSizing: 'border-box'
            }}
          >
            {images.map((img) => (
              <div 
                key={img.id}
                className="group relative overflow-hidden bg-white transition-all duration-300 ease-in-out hover:z-10"
                style={{
                  border: '3px solid black',
                  boxSizing: 'border-box',
                }}
              >
                <div className="aspect-[3.5/4.5] relative overflow-hidden bg-gray-100">
                  <Image
                    src={img.processedImageUrl}
                    alt="Processed Passport"
                    fill
                    loading="lazy"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="text-white text-center space-y-1 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Dimensions</p>
                      <p className="text-lg font-bold">{img.outputWidthCm} x {img.outputHeightCm} cm</p>
                    </div>
                    
                    <div className="flex gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                      <Button size="sm" variant="secondary" className="font-bold rounded-full" asChild>
                        <a href={img.processedImageUrl} download={`pixelpass-passport-${img.id}.png`}>
                          <Download className="mr-2 h-4 w-4" /> Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-12 bg-white mt-auto">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black opacity-60">
            <span>HD Precision</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span>Stroke: 3px Black</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span>Format: Border-Box</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
