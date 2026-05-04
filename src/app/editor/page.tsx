"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { 
  Upload, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Camera,
  Maximize2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { transformPhoto } from "@/ai/flows/ai-photo-transformation-flow";
import Link from "next/link";

export default function EditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith("image/")) {
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = () => {
          setPreviewUrl(reader.result as string);
          setProcessedUrl(null);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload an image file (PNG, JPG, etc).",
        });
      }
    }
  };

  const handleProcess = async () => {
    if (!previewUrl) return;

    setIsProcessing(true);
    setProgress(10);
    
    // Fake progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 10 : prev));
    }, 800);

    try {
      const result = await transformPhoto({ photoDataUri: previewUrl });
      clearInterval(progressInterval);
      setProgress(100);
      setProcessedUrl(result.processedPhotoDataUri);
      toast({
        title: "Success!",
        description: "Your passport photo has been professionally processed.",
      });
    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: "There was an error transforming your photo. Please try another image.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedUrl) return;
    const link = document.createElement("a");
    link.href = processedUrl;
    link.download = "pixelpass-passport-photo.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetEditor = () => {
    setFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setProgress(0);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Passport Photo Editor</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Image Preview Area */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="min-h-[500px] flex flex-col items-center justify-center border-dashed border-2 bg-white relative overflow-hidden group">
              {!previewUrl ? (
                <div 
                  className="flex flex-col items-center justify-center p-12 text-center cursor-pointer w-full h-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Upload your portrait</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Ensure the subject is facing forward with a neutral expression and eyes open.
                  </p>
                  <Button className="rounded-full px-8">Select Image</Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row gap-4 p-4">
                  <div className="flex-1 relative bg-muted rounded-xl overflow-hidden border">
                    <div className="absolute top-4 left-4 z-10 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm backdrop-blur-sm">
                      ORIGINAL
                    </div>
                    <Image 
                      src={previewUrl} 
                      alt="Original" 
                      fill 
                      className="object-contain"
                    />
                  </div>
                  
                  {processedUrl && (
                    <div className="flex-1 relative bg-white rounded-xl overflow-hidden border shadow-inner">
                      <div className="absolute top-4 left-4 z-10 bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-sm">
                        PROCESSED
                      </div>
                      <Image 
                        src={processedUrl} 
                        alt="Processed" 
                        fill 
                        className="object-contain p-2"
                      />
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-muted/30 rounded-xl border animate-pulse">
                      <div className="relative">
                        <Camera className="h-12 w-12 text-primary animate-bounce" />
                        <div className="absolute -top-1 -right-1">
                          <RefreshCw className="h-5 w-5 text-secondary animate-spin" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-lg">Enhancing Image...</p>
                        <p className="text-xs text-muted-foreground">Aligning face & upscaling to 4K</p>
                      </div>
                      <div className="w-48">
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/50">
                <CardContent className="p-4 flex gap-4 items-start">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Official Standards</h4>
                    <p className="text-xs text-muted-foreground">AI aligns eyes and head according to official biometric rules.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/50">
                <CardContent className="p-4 flex gap-4 items-start">
                  <Maximize2 className="h-5 w-5 text-secondary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Quality Guaranteed</h4>
                    <p className="text-xs text-muted-foreground">Low quality uploads are enhanced and upscaled for clear printing.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Controls and Settings */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border-none shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle>Processing Options</CardTitle>
                <CardDescription>Configure your passport photo parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Target Format</span>
                    <span className="font-semibold">Standard 2x2 inch</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Background Color</span>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border bg-white shadow-sm"></div>
                      <span className="font-semibold">Pure White</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Skin Retouching</span>
                    <span className="text-secondary font-semibold">Subtle (AI Optimized)</span>
                  </div>
                </div>

                <div className="pt-6 border-t space-y-3">
                  {!processedUrl ? (
                    <Button 
                      className="w-full h-12 text-lg font-bold" 
                      onClick={handleProcess}
                      disabled={!previewUrl || isProcessing}
                    >
                      {isProcessing ? "Processing..." : "Generate Passport Photo"}
                    </Button>
                  ) : (
                    <Button 
                      className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" 
                      onClick={handleDownload}
                    >
                      <Download className="mr-2 h-5 w-5" /> Download (Print Ready)
                    </Button>
                  )}
                  
                  {previewUrl && !isProcessing && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-destructive hover:bg-destructive/10" 
                      onClick={resetEditor}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Reset and Upload New
                    </Button>
                  )}
                </div>

                {!processedUrl && !isProcessing && (
                  <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      For best results, upload a photo with even lighting and a neutral expression. Our AI will handle the rest.
                    </p>
                  </div>
                )}
                
                {processedUrl && (
                  <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-100 flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <p className="text-xs text-green-700 leading-relaxed">
                      Your photo is ready! It has been centered, balanced, and upscaled to 4K resolution.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-white/50 border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Compliance Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  "Head Centered and Sized Correctly",
                  "Pure White Background (#FFFFFF)",
                  "Neutral Facial Expression",
                  "No Harsh Shadows",
                  "High Resolution (Print Ready)"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className={`h-3 w-3 ${processedUrl ? "text-green-500" : "text-muted"}`} />
                    <span className={processedUrl ? "text-foreground font-medium" : "text-muted-foreground"}>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}