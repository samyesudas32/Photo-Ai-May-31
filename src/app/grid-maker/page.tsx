
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
  Printer,
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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

// PHOTO STYLING CONSTANTS (Exact physical units)
const GRID_GAP_CM = 0.52;
const GRID_GAP_PX = Math.round((GRID_GAP_CM / 2.54) * DPI); // ~61px
const WHITE_BORDER_CM = 0.3;
const WHITE_BORDER_PX = Math.round((WHITE_BORDER_CM / 2.54) * DPI); // ~35px
const BLACK_STROKE_PX = 3;

export default function GridMakerPage() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(2);
  
  // Layout Controls
  const [margin, setMargin] = useState(60); 
  
  // Crop Controls
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
          setSourceImage(reader.result as string);
          setZoom(100);
          setOffsetX(0);
          setOffsetY(0);
          toast({
            title: "Photo Uploaded",
            description: `Generating ${cols}x${rows} Layout.`,
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
      const totalSpacingX = GRID_GAP_PX * (cols - 1);
      const totalSpacingY = GRID_GAP_PX * (rows - 1);

      // Grid cell size calculation (Box-Sizing: Border-Box approach)
      const cellWidth = (CANVAS_WIDTH - totalMarginX - totalSpacingX) / cols;
      const cellHeight = (CANVAS_HEIGHT - totalMarginY - totalSpacingY) / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = margin + c * (cellWidth + GRID_GAP_PX);
          const y = margin + r * (cellHeight + GRID_GAP_PX);

          // 1. Draw Black Stroke (Outer frame)
          ctx.fillStyle = "#000000";
          ctx.fillRect(x, y, cellWidth, cellHeight);

          // 2. Draw White Border (Inner frame)
          ctx.fillStyle = "#FFFFFF";
          const strokeReduction = BLACK_STROKE_PX;
          ctx.fillRect(
            x + strokeReduction, 
            y + strokeReduction, 
            cellWidth - (strokeReduction * 2), 
            cellHeight - (strokeReduction * 2)
          );

          // 3. Draw Image (Inside the white border)
          const reduction = (WHITE_BORDER_PX + strokeReduction);
          const imageAreaWidth = cellWidth - (reduction * 2);
          const imageAreaHeight = cellHeight - (reduction * 2);
          const imageAreaX = x + reduction;
          const imageAreaY = y + reduction;

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
        }
      }
    };
    img.src = sourceImage;
  }, [sourceImage, cols, rows, margin, zoom, offsetX, offsetY]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-grid-${cols}x${rows}.${format}`;
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
    pdf.save(`pixelpass-grid-${cols}x${rows}.pdf`);
    toast({ title: "PDF Ready", description: "Standard 6x4in print document generated." });
  };

  const setPreset = (c: number, r: number) => {
    setCols(c);
    setRows(r);
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
            <h1 className="text-3xl font-bold tracking-tight">Print Layout Generator</h1>
            <p className="text-muted-foreground text-sm font-medium">Professional 6x4 sheet arranged at 300 DPI</p>
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
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Layout Presets</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { l: '2', c: 2, r: 1 },
                      { l: '4', c: 2, r: 2 },
                      { l: '6', c: 3, r: 2 },
                      { l: '8', c: 4, r: 2 }
                    ].map((p) => (
                      <Button
                        key={p.l}
                        variant={cols === p.c && rows === p.r ? "default" : "outline"}
                        className="font-bold h-10"
                        onClick={() => setPreset(p.c, p.r)}
                        disabled={!sourceImage}
                      >
                        {p.l}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Grid Arrangement</Label>
                    <div className="flex flex-col items-center gap-2">
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <div />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-10 w-14"
                          onClick={() => setRows(r => Math.min(10, r + 1))}
                          disabled={!sourceImage || rows >= 10}
                          title="Add Row"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <div />
                        
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-14 w-10"
                          onClick={() => setCols(c => Math.max(1, c - 1))}
                          disabled={!sourceImage || cols <= 1}
                          title="Remove Column"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <div className="flex flex-col items-center justify-center border-2 border-primary/20 rounded-xl p-3 bg-primary/5 min-w-20 min-h-20 shadow-inner">
                          <span className="text-lg font-black text-primary">{cols}x{rows}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{cols * rows} Photos</span>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-14 w-10"
                          onClick={() => setCols(c => Math.min(10, c + 1))}
                          disabled={!sourceImage || cols >= 10}
                          title="Add Column"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>

                        <div />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-10 w-14"
                          onClick={() => setRows(r => Math.max(1, r - 1))}
                          disabled={!sourceImage || rows <= 1}
                          title="Remove Row"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <div />
                      </div>
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
                      <Slider value={[zoom]} min={50} max={300} onValueChange={(v) => setZoom(v[0])} disabled={!sourceImage} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">X-Offset</span>
                        <Slider value={[offsetX]} min={-400} max={400} onValueChange={(v) => setOffsetX(v[0])} disabled={!sourceImage} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Y-Offset</span>
                        <Slider value={[offsetY]} min={-400} max={400} onValueChange={(v) => setOffsetY(v[0])} disabled={!sourceImage} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Sheet Layout</Label>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs">Sheet Margins</span>
                    </div>
                    <Slider value={[margin]} min={0} max={200} onValueChange={(v) => setMargin(v[0])} disabled={!sourceImage} />
                  </div>
                </div>

                <div className="pt-4 space-y-2">
                  <Button className="w-full font-bold shadow-lg" onClick={() => downloadImage('png')} disabled={!sourceImage}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Download PNG (1800x1200)
                  </Button>
                  <Button variant="outline" className="w-full font-bold" onClick={downloadPDF} disabled={!sourceImage}>
                    <FileText className="mr-2 h-4 w-4" /> Print PDF (6 x 4 in)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white/40 border-2 border-dashed overflow-hidden flex flex-col items-center justify-center min-h-[650px] relative shadow-inner p-12">
              {!sourceImage ? (
                <div className="flex flex-col items-center justify-center text-center cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                  <div className="h-28 w-28 rounded-full bg-primary/5 flex items-center justify-center mb-6 ring-8 ring-primary/5 group-hover:bg-primary/10 transition-all">
                    <Printer className="h-14 w-14 text-primary/30 group-hover:text-primary/50" />
                  </div>
                  <h3 className="text-3xl font-bold mb-3 tracking-tight">Print Layout Studio</h3>
                  <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                    Upload your photo to generate a print-ready 6x4 inch layout with professional borders and spacing.
                  </p>
                  <Button size="lg" className="rounded-full px-16 font-bold text-lg shadow-xl hover:scale-105 transition-transform">
                    Start New Sheet
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
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
                  </div>
                  
                  <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-2xl border-t pt-8">
                    {[
                      { label: "Paper Size", val: "6 x 4 in" },
                      { label: "Resolution", val: "300 DPI" },
                      { label: "Stroke", val: "3 px Solid" },
                      { label: "Arrangement", val: `${cols} x ${rows}` }
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
          </div>
        </div>
      </main>
    </div>
  );
}
