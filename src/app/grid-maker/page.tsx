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
  Plus,
  Maximize2,
  Move,
  ZoomIn,
  ZoomOut
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
import { cn } from "@/lib/utils";

// Print Specifications
const CANVAS_WIDTH_IN = 6;
const CANVAS_HEIGHT_IN = 4;
const DPI = 300;
const CANVAS_WIDTH = CANVAS_WIDTH_IN * DPI; // 1800px
const CANVAS_HEIGHT = CANVAS_HEIGHT_IN * DPI; // 1200px

type LayoutPreset = 2 | 4 | 6 | 8;

export default function GridMakerPage() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState<number>(8);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(2);
  
  // Layout Controls
  const [margin, setMargin] = useState(30); 
  const [spacing, setSpacing] = useState(20);
  const [showBorders, setShowBorders] = useState(true);
  const [borderThickness, setBorderThickness] = useState(1);
  
  // Crop Controls
  const [zoom, setZoom] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Handle auto-arrangement based on count
  useEffect(() => {
    if (photoCount <= 2) { setCols(2); setRows(1); }
    else if (photoCount <= 4) { setCols(2); setRows(2); }
    else if (photoCount <= 6) { setCols(3); setRows(2); }
    else { setCols(Math.ceil(photoCount / 2)); setRows(2); }
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
            description: `Ready to generate your ${photoCount}-copy print grid.`,
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
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const totalMarginX = margin * 2;
      const totalMarginY = margin * 2;
      const totalSpacingX = spacing * (cols - 1);
      const totalSpacingY = spacing * (rows - 1);

      const tileWidth = (CANVAS_WIDTH - totalMarginX - totalSpacingX) / cols;
      const tileHeight = (CANVAS_HEIGHT - totalMarginY - totalSpacingY) / rows;

      let drawn = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (drawn >= photoCount) break;

          const x = margin + c * (tileWidth + spacing);
          const y = margin + r * (tileHeight + spacing);

          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, tileWidth, tileHeight);
          ctx.clip();

          const imgAspect = img.width / img.height;
          const tileAspect = tileWidth / tileHeight;
          
          let drawW, drawH;
          if (imgAspect > tileAspect) {
            drawH = tileHeight * (zoom / 100);
            drawW = drawH * imgAspect;
          } else {
            drawW = tileWidth * (zoom / 100);
            drawH = drawW / imgAspect;
          }

          // Center + Offset
          const drawX = x + (tileWidth - drawW) / 2 + offsetX;
          const drawY = y + (tileHeight - drawH) / 2 + offsetY;

          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();

          if (showBorders) {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = borderThickness;
            ctx.strokeRect(x, y, tileWidth, tileHeight);
          }
          drawn++;
        }
      }
    };
    img.src = sourceImage;
  }, [sourceImage, photoCount, cols, rows, margin, spacing, showBorders, borderThickness, zoom, offsetX, offsetY]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-grid-${photoCount}.${format}`;
    link.href = canvasRef.current.toDataURL(`image/${format}`, 1.0);
    link.click();
    toast({ title: `${format.toUpperCase()} Downloaded`, description: "Your print-ready grid is ready." });
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
    pdf.save(`pixelpass-grid-${photoCount}.pdf`);
    toast({ title: "PDF Downloaded", description: "Formatted exactly to 6x4 inches for printing." });
  };

  const reset = () => {
    setSourceImage(null);
    setPhotoCount(8);
    setMargin(30);
    setSpacing(20);
    setZoom(100);
    setOffsetX(0);
    setOffsetY(0);
    setShowBorders(true);
    setBorderThickness(1);
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                6 x 4 in @ 300 DPI
              </span>
              <p className="text-muted-foreground text-sm">Generate multiple copies on one print sheet.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> {sourceImage ? "Change Photo" : "Upload Photo"}
            </Button>
            {sourceImage && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={reset}>
                <Trash2 className="h-4 w-4 mr-2" /> Reset
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls Panel */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-lg border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" /> Layout Presets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 6, 8].map((count) => (
                    <Button
                      key={count}
                      variant={photoCount === count ? "default" : "outline"}
                      className="w-full font-bold"
                      onClick={() => setPhotoCount(count)}
                      disabled={!sourceImage}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <Label className="text-sm font-semibold">Custom Count</Label>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-full"
                      onClick={() => setPhotoCount(Math.max(1, photoCount - 1))}
                      disabled={!sourceImage || photoCount <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="font-mono font-bold w-6 text-center">{photoCount}</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-full"
                      onClick={() => setPhotoCount(Math.min(12, photoCount + 1))}
                      disabled={!sourceImage || photoCount >= 12}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Move className="h-3 w-3" /> Crop & Position
                  </Label>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs flex items-center gap-1"><ZoomIn className="h-3 w-3" /> Zoom</span>
                        <span className="text-[10px] font-mono">{zoom}%</span>
                      </div>
                      <Slider 
                        value={[zoom]} 
                        min={50} 
                        max={300} 
                        step={1} 
                        onValueChange={(v) => setZoom(v[0])}
                        disabled={!sourceImage}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Offset X</span>
                        <Slider 
                          value={[offsetX]} 
                          min={-500} 
                          max={500} 
                          step={1} 
                          onValueChange={(v) => setOffsetX(v[0])}
                          disabled={!sourceImage}
                        />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Offset Y</span>
                        <Slider 
                          value={[offsetY]} 
                          min={-500} 
                          max={500} 
                          step={1} 
                          onValueChange={(v) => setOffsetY(v[0])}
                          disabled={!sourceImage}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Settings2 className="h-3 w-3" /> Grid Settings
                  </Label>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Margins</span>
                        <span className="text-[10px] font-mono">{pxToMm(margin)} mm</span>
                      </div>
                      <Slider value={[margin]} min={0} max={200} step={1} onValueChange={(v) => setMargin(v[0])} disabled={!sourceImage} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Spacing</span>
                        <span className="text-[10px] font-mono">{pxToMm(spacing)} mm</span>
                      </div>
                      <Slider value={[spacing]} min={0} max={150} step={1} onValueChange={(v) => setSpacing(v[0])} disabled={!sourceImage} />
                    </div>

                    <div className="flex items-center justify-between py-2 border-y">
                      <div className="space-y-0.5">
                        <Label htmlFor="borders" className="text-xs font-bold">Cut Borders</Label>
                        <p className="text-[9px] text-muted-foreground">Thin line for easy cutting.</p>
                      </div>
                      <Switch id="borders" checked={showBorders} onCheckedChange={setShowBorders} disabled={!sourceImage} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <Button className="w-full font-bold shadow-md" onClick={() => downloadImage('png')} disabled={!sourceImage}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Download PNG
                  </Button>
                  <Button variant="secondary" className="w-full font-bold shadow-sm" onClick={() => downloadImage('jpeg')} disabled={!sourceImage}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Download JPG
                  </Button>
                  <Button variant="outline" className="w-full font-bold" onClick={downloadPDF} disabled={!sourceImage}>
                    <FileText className="mr-2 h-4 w-4" /> Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Canvas Preview Area */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white/50 border-2 border-dashed overflow-hidden flex flex-col items-center justify-center min-h-[600px] relative shadow-inner p-8">
              {!sourceImage ? (
                <div 
                  className="flex flex-col items-center justify-center text-center cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-24 w-24 rounded-full bg-primary/5 flex items-center justify-center mb-6 ring-8 ring-primary/5 group-hover:bg-primary/10 transition-all">
                    <Printer className="h-12 w-12 text-primary/40 group-hover:text-primary/60" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Create Your Print Grid</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Upload a photo to generate a high-quality 6x4" print sheet at 300 DPI.
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
                <div className="w-full flex flex-col items-center">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg blur-xl"></div>
                    <div className="relative bg-white p-2 shadow-2xl rounded-sm border">
                      <canvas 
                        ref={canvasRef} 
                        width={CANVAS_WIDTH} 
                        height={CANVAS_HEIGHT} 
                        className="max-w-full h-auto bg-white"
                        style={{ width: '100%', maxWidth: '650px' }}
                      />
                    </div>
                    <div className="absolute -top-3 -left-3 bg-black text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl uppercase tracking-widest z-10">
                      Print Preview
                    </div>
                  </div>
                  
                  <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-2xl">
                    {[
                      { label: "Sheet Size", val: "6 x 4 in" },
                      { label: "Resolution", val: "300 DPI" },
                      { label: "Dimensions", val: "1800 x 1200 px" },
                      { label: "Orientation", val: "Landscape" }
                    ].map((spec, i) => (
                      <div key={i} className="text-center space-y-1">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{spec.label}</p>
                        <p className="text-xs font-bold text-primary">{spec.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-white/40 rounded-xl border border-white/50">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Printer className="h-4 w-4 text-green-600" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs uppercase tracking-tight">Print Ready</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight">Optimized for standard 4x6" home or professional printers.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white/40 rounded-xl border border-white/50">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Maximize2 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs uppercase tracking-tight">Biometric Safe</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight">No filters or AI alterations applied to your original photo.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white/40 rounded-xl border border-white/50">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Move className="h-4 w-4 text-purple-600" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs uppercase tracking-tight">Precise Crop</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight">Manually adjust zoom and positioning for perfect alignment.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
