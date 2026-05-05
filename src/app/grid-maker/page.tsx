
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { 
  Upload, 
  Download, 
  ArrowLeft, 
  Grid3X3, 
  FileText, 
  Image as ImageIcon,
  Settings2,
  Trash2,
  Printer,
  Minus,
  Plus,
  Move,
  CheckCircle2,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";

// PRINT SPECIFICATIONS
const DPI = 300;
const CANVAS_WIDTH_IN = 6;
const CANVAS_HEIGHT_IN = 4;
const CANVAS_WIDTH = CANVAS_WIDTH_IN * DPI; // 1800px
const CANVAS_HEIGHT = CANVAS_HEIGHT_IN * DPI; // 1200px

// PHOTO STYLING CONSTANTS (0.3cm at 300 DPI)
const WHITE_BORDER_PX = Math.round((0.3 / 2.54) * DPI); // ~35px
const BLACK_STROKE_PX = 3;

export default function GridMakerPage() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState<number>(8);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(2);
  
  // Layout Controls
  const [margin, setMargin] = useState(40); 
  const [spacing, setSpacing] = useState(30);
  const [showBorders, setShowBorders] = useState(true);
  
  // Crop Controls
  const [zoom, setZoom] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-arrange logic
  useEffect(() => {
    if (photoCount <= 2) { setCols(2); setRows(1); }
    else if (photoCount <= 4) { setCols(2); setRows(2); }
    else if (photoCount <= 6) { setCols(3); setRows(2); }
    else { setCols(4); setRows(2); }
  }, [photoCount]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setSourceImage(reader.result as string);
          setZoom(100);
          setOffsetX(0);
          setOffsetY(0);
          toast({
            title: "Photo Uploaded",
            description: `Generating 6x4 grid layout.`,
          });
        };
        reader.readAsDataURL(file);
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
      // Clear and fill white background
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const totalMarginX = margin * 2;
      const totalMarginY = margin * 2;
      const totalSpacingX = spacing * (cols - 1);
      const totalSpacingY = spacing * (rows - 1);

      // Grid cell size
      const cellWidth = (CANVAS_WIDTH - totalMarginX - totalSpacingX) / cols;
      const cellHeight = (CANVAS_HEIGHT - totalMarginY - totalSpacingY) / rows;

      let drawn = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (drawn >= photoCount) break;

          const x = margin + c * (cellWidth + spacing);
          const y = margin + r * (cellHeight + spacing);

          // 1. Calculate the Image Area (Inside the white border and stroke)
          const reduction = (WHITE_BORDER_PX + (showBorders ? BLACK_STROKE_PX : 0));
          const imageAreaWidth = cellWidth - (reduction * 2);
          const imageAreaHeight = cellHeight - (reduction * 2);
          const imageAreaX = x + reduction;
          const imageAreaY = y + reduction;

          // 2. Draw Black Stroke (Outer frame)
          if (showBorders) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(x, y, cellWidth, cellHeight);
          }

          // 3. Draw White Border (Inner frame)
          ctx.fillStyle = "#FFFFFF";
          const strokeReduction = showBorders ? BLACK_STROKE_PX : 0;
          ctx.fillRect(
            x + strokeReduction, 
            y + strokeReduction, 
            cellWidth - (strokeReduction * 2), 
            cellHeight - (strokeReduction * 2)
          );

          // 4. Draw the actual photo inside
          ctx.save();
          ctx.beginPath();
          ctx.rect(imageAreaX, imageAreaY, imageAreaWidth, imageAreaHeight);
          ctx.clip();

          const imgAspect = img.width / img.height;
          const areaAspect = imageAreaWidth / imageAreaHeight;
          
          let drawW, drawH;
          if (imgAspect > areaAspect) {
            drawH = imageAreaHeight * (zoom / 100);
            drawW = drawH * imgAspect;
          } else {
            drawW = imageAreaWidth * (zoom / 100);
            drawH = drawW / imgAspect;
          }

          const drawX = imageAreaX + (imageAreaWidth - drawW) / 2 + offsetX;
          const drawY = imageAreaY + (imageAreaHeight - drawH) / 2 + offsetY;

          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();

          drawn++;
        }
      }
    };
    img.src = sourceImage;
  }, [sourceImage, photoCount, cols, rows, margin, spacing, showBorders, zoom, offsetX, offsetY]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-print-grid-${photoCount}.${format}`;
    link.href = canvasRef.current.toDataURL(`image/${format}`, 1.0);
    link.click();
    toast({ title: "Success", description: `${format.toUpperCase()} grid saved.` });
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
    pdf.save(`pixelpass-print-grid-${photoCount}.pdf`);
    toast({ title: "PDF Ready", description: "Standard 6x4in print document generated." });
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
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Print Layout Generator</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-primary text-white px-2.5 py-1 rounded-sm uppercase tracking-widest">
                6 x 4 in @ 300 DPI
              </span>
              <p className="text-muted-foreground text-sm font-medium">Professional photo-sheet generator.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> {sourceImage ? "Change Photo" : "Upload Photo"}
            </Button>
            {sourceImage && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setSourceImage(null)}>
                <Trash2 className="h-4 w-4 mr-2" /> Reset
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL: CONTROLS */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Photo Copies</Label>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 4, 6, 8].map((count) => (
                      <Button
                        key={count}
                        variant={photoCount === count ? "default" : "outline"}
                        className="font-bold h-10"
                        onClick={() => setPhotoCount(count)}
                        disabled={!sourceImage}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <Label className="text-sm font-semibold">Total Copies</Label>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full"
                        onClick={() => setPhotoCount(Math.max(1, photoCount - 1))}
                        disabled={!sourceImage || photoCount <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input 
                        type="number"
                        min={1}
                        max={32}
                        value={photoCount}
                        onChange={(e) => setPhotoCount(Math.max(1, Math.min(32, parseInt(e.target.value) || 1)))}
                        className="h-8 w-14 text-center font-bold"
                        disabled={!sourceImage}
                      />
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 rounded-full"
                        onClick={() => setPhotoCount(Math.min(32, photoCount + 1))}
                        disabled={!sourceImage || photoCount >= 32}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t">
                  <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Move className="h-3 w-3" /> Crop & Reposition
                  </Label>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Zoom</span>
                        <span className="text-[10px] font-mono">{zoom}%</span>
                      </div>
                      <Slider 
                        value={[zoom]} 
                        min={50} 
                        max={300} 
                        onValueChange={(v) => setZoom(v[0])}
                        disabled={!sourceImage}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">X-Offset</span>
                        <Slider 
                          value={[offsetX]} 
                          min={-400} 
                          max={400} 
                          onValueChange={(v) => setOffsetX(v[0])}
                          disabled={!sourceImage}
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Y-Offset</span>
                        <Slider 
                          value={[offsetY]} 
                          min={-400} 
                          max={400} 
                          onValueChange={(v) => setOffsetY(v[0])}
                          disabled={!sourceImage}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t">
                  <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Settings2 className="h-3 w-3" /> Layout Metrics
                  </Label>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Sheet Margins</span>
                        <span className="text-[10px] font-mono">{pxToMm(margin)} mm</span>
                      </div>
                      <Slider value={[margin]} min={0} max={150} onValueChange={(v) => setMargin(v[0])} disabled={!sourceImage} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Block Spacing</span>
                        <span className="text-[10px] font-mono">{pxToMm(spacing)} mm</span>
                      </div>
                      <Slider value={[spacing]} min={0} max={100} onValueChange={(v) => setSpacing(v[0])} disabled={!sourceImage} />
                    </div>

                    <div className="flex items-center justify-between py-3 border-y">
                      <div className="space-y-0.5">
                        <Label htmlFor="borders" className="text-xs font-bold">Black Stroke Frame</Label>
                        <p className="text-[9px] text-muted-foreground">3px outline around whiteboard border.</p>
                      </div>
                      <Switch id="borders" checked={showBorders} onCheckedChange={setShowBorders} disabled={!sourceImage} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <Button className="w-full font-bold shadow-lg" onClick={() => downloadImage('png')} disabled={!sourceImage}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Download PNG (1800x1200)
                  </Button>
                  <Button variant="secondary" className="w-full font-bold shadow-md" onClick={() => downloadImage('jpeg')} disabled={!sourceImage}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Download JPG (High Res)
                  </Button>
                  <Button variant="outline" className="w-full font-bold" onClick={downloadPDF} disabled={!sourceImage}>
                    <FileText className="mr-2 h-4 w-4" /> Print PDF (6 x 4 in)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MAIN AREA: LIVE PREVIEW */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white/40 border-2 border-dashed overflow-hidden flex flex-col items-center justify-center min-h-[650px] relative shadow-inner p-12">
              {!sourceImage ? (
                <div 
                  className="flex flex-col items-center justify-center text-center cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-28 w-28 rounded-full bg-primary/5 flex items-center justify-center mb-6 ring-8 ring-primary/5 group-hover:bg-primary/10 transition-all">
                    <Printer className="h-14 w-14 text-primary/30 group-hover:text-primary/50" />
                  </div>
                  <h3 className="text-3xl font-bold mb-3 tracking-tight">Print Layout Studio</h3>
                  <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                    Upload a portrait to create an 1800x1200px print sheet formatted specifically for 4x6" photo paper.
                  </p>
                  <Button size="lg" className="rounded-full px-16 font-bold text-lg shadow-xl hover:scale-105 transition-transform">
                    Start New Sheet
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute -inset-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl blur-3xl"></div>
                    <div className="relative bg-white p-3 shadow-2xl rounded-sm border ring-1 ring-black/5">
                      <canvas 
                        ref={canvasRef} 
                        width={CANVAS_WIDTH} 
                        height={CANVAS_HEIGHT} 
                        className="max-w-full h-auto bg-white"
                        style={{ width: '100%', maxWidth: '700px' }}
                      />
                    </div>
                    <div className="absolute -top-4 -left-4 bg-black text-white text-[10px] font-black px-6 py-2 rounded-full shadow-2xl uppercase tracking-[0.2em] z-10 border border-white/20">
                      300 DPI MASTER PREVIEW
                    </div>
                  </div>
                  
                  <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-2xl border-t pt-8">
                    {[
                      { label: "Paper Size", val: "6 x 4 in" },
                      { label: "Resolution", val: "300 DPI" },
                      { label: "Pixel Output", val: "1800 x 1200" },
                      { label: "Layout Mode", val: `${cols}x${rows} Grid` }
                    ].map((spec, i) => (
                      <div key={i} className="text-center space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{spec.label}</p>
                        <p className="text-sm font-bold text-primary">{spec.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm uppercase tracking-tight">Whiteboard Border</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">Exact 0.3cm margin around every portrait for a clean, professional finish.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Maximize2 className="h-5 w-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm uppercase tracking-tight">Pixel Perfect</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">Canvas optimized at 300 DPI for high-end home or commercial printers.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Grid3X3 className="h-5 w-5 text-purple-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm uppercase tracking-tight">Smart Grid</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">Automatically calculates optimal rows and columns for your photo count.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
