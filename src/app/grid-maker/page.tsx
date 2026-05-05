
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Upload, 
  Download, 
  ArrowLeft, 
  Grid3X3, 
  FileText, 
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Plus,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import Image from "next/image";

// PRINT SPECIFICATIONS
const DPI = 300;
const CANVAS_WIDTH_IN = 6;
const CANVAS_HEIGHT_IN = 4;
const CANVAS_WIDTH = CANVAS_WIDTH_IN * DPI; // 1800px
const CANVAS_HEIGHT = CANVAS_HEIGHT_IN * DPI; // 1200px

// PHOTO DIMENSIONS (Standard Passport: 3.5cm x 4.5cm)
const PHOTO_WIDTH_CM = 3.5;
const PHOTO_HEIGHT_CM = 4.5;
const PHOTO_WIDTH_PX = Math.round((PHOTO_WIDTH_CM / 2.54) * DPI); // ~413px
const PHOTO_HEIGHT_PX = Math.round((PHOTO_HEIGHT_CM / 2.54) * DPI); // ~531px

// SPACING
const GRID_GAP_CM = 0.52;
const GRID_GAP_PX = Math.round((GRID_GAP_CM / 2.54) * DPI); // ~61px

export default function GridMakerPage() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [numCopies, setNumCopies] = useState(8);
  const [zoom, setZoom] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setImageUri(reader.result as string);
          setZoom(100);
          setOffsetX(0);
          setOffsetY(0);
          toast({
            title: "Photo Uploaded",
            description: "Ready to arrange on the print sheet.",
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const drawGrid = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (!imageUri) return;

    const img = new window.Image();
    img.onload = () => {
      const cols = 4;
      const rows = Math.ceil(numCopies / cols);

      const totalGridWidth = (PHOTO_WIDTH_PX * cols) + (GRID_GAP_PX * (cols - 1));
      const totalGridHeight = (PHOTO_WIDTH_PX * rows) + (GRID_GAP_PX * (rows - 1));
      
      const startX = (CANVAS_WIDTH - totalGridWidth) / 2;
      const startY = (CANVAS_HEIGHT - totalGridHeight) / 2;

      for (let i = 0; i < numCopies; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);

        const x = startX + c * (PHOTO_WIDTH_PX + GRID_GAP_PX);
        const y = startY + r * (PHOTO_HEIGHT_PX + GRID_GAP_PX);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, PHOTO_WIDTH_PX, PHOTO_HEIGHT_PX);
        ctx.clip();

        const imgAspect = img.width / img.height;
        const areaAspect = PHOTO_WIDTH_PX / PHOTO_HEIGHT_PX;
        
        let drawW, drawH;
        if (imgAspect > areaAspect) {
          drawH = PHOTO_HEIGHT_PX * (zoom / 100);
          drawW = drawH * imgAspect;
        } else {
          drawW = PHOTO_WIDTH_PX * (zoom / 100);
          drawH = drawW / imgAspect;
        }

        const drawX = x + (PHOTO_WIDTH_PX - drawW) / 2 + offsetX;
        const drawY = y + (PHOTO_HEIGHT_PX - drawH) / 2 + offsetY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
      }
    };
    img.src = imageUri;
  }, [imageUri, numCopies, zoom, offsetX, offsetY]);

  useEffect(() => {
    const timeout = setTimeout(drawGrid, 100);
    return () => clearTimeout(timeout);
  }, [drawGrid]);

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-precision-sheet.${format}`;
    link.href = canvasRef.current.toDataURL(`image/${format}`, 1.0);
    link.click();
    toast({ title: "Success", description: "Sheet saved for printing." });
  };

  const downloadPDF = () => {
    if (!canvasRef.current) return;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [6, 4]
    });
    const imgData = canvasRef.current.toDataURL("image/jpeg", 1.0);
    pdf.addImage(imgData, "JPEG", 0, 0, 6, 4);
    pdf.save(`pixelpass-precision-sheet.pdf`);
    toast({ title: "PDF Ready", description: "Standard 6x4in print document generated." });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Precision Sheet Generator</h1>
            <p className="text-muted-foreground text-sm font-medium">6x4 INCH • 300 DPI • 0.52CM GAP</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" /> Configuration
                </CardTitle>
                <CardDescription>Setup your print sheet layout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Button 
                    className="w-full h-12 font-bold" 
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" /> {imageUri ? "Change Photo" : "Upload Passport Photo"}
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*" 
                  />
                </div>

                {imageUri && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-muted-foreground uppercase">Total Copies</span>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setNumCopies(prev => Math.max(1, prev - 1))}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-bold text-primary">{numCopies}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setNumCopies(prev => Math.min(32, prev + 1))}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Slider 
                        value={[numCopies]} 
                        min={1} 
                        max={32} 
                        step={1} 
                        onValueChange={(v) => setNumCopies(v[0])} 
                      />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-muted-foreground uppercase">Zoom</span>
                        <span className="text-xs font-mono text-primary">{zoom}%</span>
                      </div>
                      <Slider value={[zoom]} min={50} max={200} step={1} onValueChange={(v) => setZoom(v[0])} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">Horizontal Shift</span>
                        <Slider value={[offsetX]} min={-200} max={200} step={1} onValueChange={(v) => setOffsetX(v[0])} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">Vertical Shift</span>
                        <Slider value={[offsetY]} min={-200} max={200} step={1} onValueChange={(v) => setOffsetY(v[0])} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t space-y-3">
                  <Button 
                    className="w-full h-12 font-bold shadow-lg" 
                    onClick={() => downloadImage('jpeg')}
                    disabled={!imageUri}
                  >
                    <Download className="mr-2 h-5 w-5" /> Download JPG
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 font-bold" 
                    onClick={downloadPDF}
                    disabled={!imageUri}
                  >
                    <FileText className="mr-2 h-5 w-5" /> Export PDF
                  </Button>
                  {imageUri && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-destructive hover:bg-destructive/10" 
                      onClick={() => setImageUri(null)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Reset Sheet
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8">
            <Card className="bg-slate-50 border-none flex flex-col items-center justify-center p-8 min-h-[600px] relative overflow-hidden">
              <div className="relative shadow-2xl bg-white">
                {/* Fixed aspect ratio container for the 6x4 sheet */}
                <div 
                  className="relative bg-white overflow-hidden"
                  style={{ 
                    width: '600px', 
                    height: '400px',
                    boxShadow: '0 0 0 1px #e2e8f0'
                  }}
                >
                  <canvas 
                    ref={canvasRef} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT} 
                    className="absolute inset-0 w-full h-full"
                  />
                  
                  {!imageUri && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                      <ImageIcon className="h-16 w-16 text-slate-200 mb-4" />
                      <h3 className="text-lg font-bold text-slate-400">Print Canvas Empty</h3>
                      <p className="text-sm text-slate-400 max-w-xs">Upload a passport photo to see the precision 6x4 arrangement.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-12 w-full max-w-xl">
                {[
                  { label: "Format", val: "6 x 4 in" },
                  { label: "DPI", val: "300 Fixed" },
                  { label: "Gap", val: "0.52 cm" },
                  { label: "Resolution", val: "1800 x 1200" }
                ].map((spec, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{spec.label}</p>
                    <p className="text-xs font-bold text-primary">{spec.val}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
