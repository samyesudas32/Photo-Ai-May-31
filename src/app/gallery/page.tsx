
"use client";

import { useMemoFirebase, useCollection, useUser } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import Image from "next/image";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { ImageIcon, Loader2, Camera } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GalleryPage() {
  const { user } = useUser();

  const processedImagesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(user.uid ? `/users/${user.uid}/processed_images` : "temp"),
      orderBy("createdAt", "desc")
    );
  }, [user]);

  const { data: images, isLoading } = useCollection(processedImagesQuery);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD]">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Photo Gallery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your professional passport transformations history.
            </p>
          </div>
          <Button asChild className="rounded-full">
            <Link href="/editor">
              <Camera className="mr-2 h-4 w-4" /> Transform New Photo
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Loading your gallery...</p>
          </div>
        ) : !images || images.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 bg-white/50">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">No photos yet</h3>
            <p className="text-muted-foreground max-w-xs mb-6">
              Start by transforming a casual portrait into a professional passport photo in our AI Editor.
            </p>
            <Button asChild variant="outline">
              <Link href="/editor">Go to AI Editor</Link>
            </Button>
          </Card>
        ) : (
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            style={{ 
              display: 'grid',
              gap: '0.52cm',
              boxSizing: 'border-box'
            }}
          >
            {images.map((img) => (
              <div 
                key={img.id}
                className="group relative overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300"
                style={{
                  border: '3px solid black',
                  boxSizing: 'border-box'
                }}
              >
                <div className="aspect-[3.5/4.5] relative overflow-hidden">
                  <Image
                    src={img.processedImageUrl}
                    alt="Processed Passport"
                    fill
                    loading="lazy"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" className="font-bold" asChild>
                    <a href={img.processedImageUrl} download={`passport-${img.id}.png`}>
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-8 bg-white mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-black">
            PixelPass AI Gallery &bull; 3px Stroke &bull; 0.52cm Gap
          </p>
        </div>
      </footer>
    </div>
  );
}
