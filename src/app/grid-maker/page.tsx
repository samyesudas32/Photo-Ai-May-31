"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { 
  Upload, 
  Download, 
  RefreshCw, 
  ArrowLeft, 
  Grid3X3, 
  FileText, 
  Image as ImageIcon,
  Settings2,
  Trash2,
  Printer,
  Minus,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Link from "next/link";
import { jsPDF } from "jspdf";

// Print Specifications
const CANVAS_WIDTH_IN = 6;
const CANVAS_HEIGHT_IN = 4;
const DPI = 300;
const CANVAS_WIDTH = CANVAS_WIDTH_IN * DPI; // 1800px
const CANVAS_HEIGHT = CANVAS_HEIGHT_IN * DPI; // 1200px
const ROWS = 2;
const COLS = 4;

export default function GridMakerPage() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [margin, setMargin] = useState(30); // in pixels at 300 DPI (~2.5mm)
  const [spacing, setSpacing] = useState(20); // in pixels at 300 DPI (~1.7mm)
  const [showBorders, setShowBorders] = useState(true);
  const [photoScale, setPhotoScale] = useState(100);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setSourceImage(reader.result as string);
          toast({
            title: "Photo Uploaded",
            description: "Ready to generate your 8-copy print grid.",
          });
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file",
          description: "Please upload an image file (JPG, PNG).",
        });
      }
    }
  };

  const drawGrid = useCallback(() => {
    if (!sourceImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.onload = () => {
      // 1. Fill white background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Calculate tile dimensions
      const totalMarginX = margin * 2;
      const totalMarginY = margin * 2;
      const totalSpacingX = spacing * (COLS - 1);
      const totalSpacingY = spacing * (ROWS - 1);

      const tileWidth = (CANVAS_WIDTH - totalMarginX - totalSpacingX) / COLS;
      const tileHeight = (CANVAS_HEIGHT - totalMarginY - totalSpacingY) / ROWS;

      // 3. Draw 2x4 grid
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = margin + c * (tileWidth + spacing);
          const y = margin + r * (tileHeight + spacing);

          ctx.save();
          
          // Draw image centered in tile (Object-fit: cover behavior)
          ctx.beginPath();
          ctx.rect(x, y, tileWidth, tileHeight);
          ctx.clip();

          const imgAspect = img.width / img.height;
          const tileAspect = tileWidth / tileHeight;
          
          let drawW, drawH, drawX, drawY;
          
          if (imgAspect > tileAspect) {
            drawH = tileHeight * (photoScale / 100);
            drawW = drawH * imgAspect;
          } else {
            drawW = tileWidth * (photoScale / 100);
            drawH = drawW / imgAspect;
          }

          drawX = x + (tileWidth - drawW) / 2;
          drawY = y + (tileHeight - drawH) / 2;

          // Draw the image
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          
          ctx.restore();

          // Draw border separately to ensure it's not clipped and is exactly 1px
          if (showBorders) {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, tileWidth, tileHeight);
          }
        }
      }
    };
    img.src = sourceImage;
  }, [sourceImage, margin, spacing, showBorders, photoScale]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "pixelpass-grid-6x4-300dpi.png";
    link.href = canvasRef.current.toDataURL("image/png", 1.0);
    link.click();
    toast({ title: "PNG Downloaded", description: "Your 1800x1200 print-ready grid is ready." });
  };

  const downloadPDF = () => {
    if (!canvasRef.current) return;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [6, 4]
    });
    const imgData = canvasRef.current.toDataURL("image/jpeg", 1.0);
    pdf.addImage(imgData, "JPEG", 0, 0, 6, 4, undefined, 'FAST');
    pdf.save("pixelpass-grid-6x4.pdf");
    toast({ title: "PDF Downloaded", description: "Your PDF is formatted exactly to 6x4 inches for printing." });
  };

  const reset = () => {
    setSourceImage(null);
    setMargin(30);
    setSpacing(20);
    setPhotoScale(100);
    setShowBorders(true);
    toast({ title: "Grid Reset", description: "Editor cleared." });
  };

  const pxToMm = (px: number) => ((px / DPI) * 25.4).toFixed(1);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Passport Photo Grid Maker</h1>
            <p className="text-muted-foreground text-sm">Generate 8 copies on a standard 6x4" photo sheet.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!!sourceImage}>
              <Upload className="h-4 w-4 mr-2" /> Upload New
            </Button>
            {sourceImage && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={reset}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Canvas Workspace */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white/50 border-2 border-dashed overflow-hidden flex items-center justify-center min-h-[500px] relative shadow-inner">
              {!sourceImage ? (
                <div 
                  className="flex flex-col items-center justify-center p-12 text-center cursor-pointer w-full h-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center mb-6 ring-8 ring-primary/5">
                    <Grid3X3 className="h-12 w-12 text-primary/60" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Create Your Print Grid</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Upload a passport-ready photo to generate 8 identical copies (2x4) at 300 DPI resolution.
                  </p>
                  <Button size="lg" className="rounded-full px-12 font-bold shadow-lg">Select Photo</Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="w-full p-6 md:p-12 flex flex-col items-center">
                  <div className="relative group transition-all duration-300">
                    <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg blur opacity-50"></div>
                    <div className="relative bg-white p-2 shadow-2xl rounded-sm">
                      <canvas 
                        ref={canvasRef} 
                        width={CANVAS_WIDTH} 
                        height={CANVAS_HEIGHT} 
                        className="max-w-full h-auto border-4 border-muted"
                        style={{ width: '100%', maxWidth: '600px' }}
                      />
                    </div>
                    <div className="absolute -top-4 -left-4 bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl uppercase tracking-wider">
                      Print Preview (6x4 IN)
                    </div>
                  </div>
                  <div className="mt-8 flex items-center gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Printer className="h-3 w-3" /> 300 DPI</span>
                    <span className="flex items-center gap-2"><Maximize2 className="h-3 w-3" /> 1800 x 1200 PX</span>
                    <span className="flex items-center gap-2"><ImageIcon className="h-3 w-3" /> 2x4 Layout</span>
                  </div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/40 border-none">
                <CardContent className="p-4 flex gap-4 items-start">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Printer className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Professional Quality</h4>
                    <p className="text-xs text-muted-foreground">High-resolution output ensures clean, biometric-ready prints on 4x6" paper.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/40 border-none">
                <CardContent className="p-4 flex gap-4 items-start">
                  <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                    <Settings2 className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Flexible Layout</h4>
                    <p className="text-xs text-muted-foreground">Easily adjust spacing and margins to match specific local printing requirements.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border-none shadow-2xl sticky top-24">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Layout Controls</CardTitle>
                </div>
                <CardDescription>Customize your 2x4 print grid sheet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Margins */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Outer Margins</Label>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{pxToMm(margin)} mm</span>
                  </div>
                  <Slider 
                    value={[margin]} 
                    min={0} 
                    max={150} 
                    step={1} 
                    onValueChange={(v) => setMargin(v[0])}
                    disabled={!sourceImage}
                    className="cursor-pointer"
                  />
                </div>

                {/* Spacing */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tile Spacing</Label>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{pxToMm(spacing)} mm</span>
                  </div>
                  <Slider 
                    value={[spacing]} 
                    min={0} 
                    max={100} 
                    step={1} 
                    onValueChange={(v) => setSpacing(v[0])}
                    disabled={!sourceImage}
                    className="cursor-pointer"
                  />
                </div>

                {/* Scale */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Photo Scaling</Label>
                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{photoScale}%</span>
                  </div>
                  <Slider 
                    value={[photoScale]} 
                    min={80} 
                    max={120} 
                    step={1} 
                    onValueChange={(v) => setPhotoScale(v[0])}
                    disabled={!sourceImage}
                    className="cursor-pointer"
                  />
                </div>

                {/* Border Toggle */}
                <div className="flex items-center justify-between py-4 border-y">
                  <div className="space-y-0.5">
                    <Label htmlFor="borders" className="text-sm font-bold cursor-pointer">Cut Borders</Label>
                    <p className="text-[10px] text-muted-foreground">Thin black line for easy cutting.</p>
                  </div>
                  <Switch 
                    id="borders" 
                    checked={showBorders} 
                    onCheckedChange={setShowBorders} 
                    disabled={!sourceImage}
                  />
                </div>

                {/* Actions */}
                <div className="pt-4 space-y-3">
                  <Button 
                    className="w-full h-14 text-lg font-bold shadow-lg bg-primary hover:shadow-xl transition-all" 
                    onClick={downloadPNG}
                    disabled={!sourceImage}
                  >
                    <ImageIcon className="mr-2 h-5 w-5" /> Download PNG
                  </Button>
                  <Button 
                    variant="secondary"
                    className="w-full h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all" 
                    onClick={downloadPDF}
                    disabled={!sourceImage}
                  >
                    <FileText className="mr-2 h-5 w-5" /> Download PDF
                  </Button>
                  
                  {sourceImage && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-xs text-muted-foreground hover:text-destructive" 
                      onClick={reset}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" /> Reset all settings
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Maximize2({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  );
}
