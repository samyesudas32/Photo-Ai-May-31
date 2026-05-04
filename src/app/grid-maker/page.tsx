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
  Printer
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

const CANVAS_WIDTH_IN = 6;
const CANVAS_HEIGHT_IN = 4;
const DPI = 300;
const CANVAS_WIDTH = CANVAS_WIDTH_IN * DPI; // 1800
const CANVAS_HEIGHT = CANVAS_HEIGHT_IN * DPI; // 1200
const ROWS = 2;
const COLS = 4;

export default function GridMakerPage() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [margin, setMargin] = useState(20); // in pixels at 300 DPI
  const [spacing, setSpacing] = useState(15); // in pixels at 300 DPI
  const [showBorders, setShowBorders] = useState(true);
  const [photoScale, setPhotoScale] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => setSourceImage(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file",
          description: "Please upload an image file.",
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
      // Clear canvas
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Calculate tile dimensions
      const totalMarginX = margin * 2;
      const totalMarginY = margin * 2;
      const totalSpacingX = spacing * (COLS - 1);
      const totalSpacingY = spacing * (ROWS - 1);

      const tileWidth = (CANVAS_WIDTH - totalMarginX - totalSpacingX) / COLS;
      const tileHeight = (CANVAS_HEIGHT - totalMarginY - totalSpacingY) / ROWS;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = margin + c * (tileWidth + spacing);
          const y = margin + r * (tileHeight + spacing);

          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, tileWidth, tileHeight);
          ctx.clip();

          // Calculate image scaling to fill tile (cover)
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

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          if (showBorders) {
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, tileWidth, tileHeight);
          }
          ctx.restore();
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
    link.download = "passport-grid-6x4.png";
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
    pdf.addImage(imgData, "JPEG", 0, 0, 6, 4);
    pdf.save("passport-grid-6x4.pdf");
    toast({ title: "PDF Downloaded", description: "Your PDF is formatted exactly to 6x4 inches." });
  };

  const reset = () => {
    setSourceImage(null);
    setMargin(20);
    setSpacing(15);
    setPhotoScale(100);
    setShowBorders(true);
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
          <h1 className="text-3xl font-bold tracking-tight">Passport Grid Maker</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Workspace */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-white border-2 border-dashed overflow-hidden flex items-center justify-center min-h-[500px] relative">
              {!sourceImage ? (
                <div 
                  className="flex flex-col items-center justify-center p-12 text-center cursor-pointer w-full h-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Grid3X3 className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Create Your Print Grid</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Upload one photo to generate a 2x4 grid (8 copies) on a 4x6" sheet.
                  </p>
                  <Button className="rounded-full px-8">Upload Photo</Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="w-full p-8 flex flex-col items-center">
                  <div className="relative shadow-2xl border-8 border-white bg-white">
                    <canvas 
                      ref={canvasRef} 
                      width={CANVAS_WIDTH} 
                      height={CANVAS_HEIGHT} 
                      className="max-w-full h-auto border shadow-sm"
                      style={{ width: '100%', maxWidth: '600px' }}
                    />
                    <div className="absolute -top-4 -left-4 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                      PRINT PREVIEW (6x4 INCH)
                    </div>
                  </div>
                  <p className="mt-6 text-sm text-muted-foreground italic">
                    Grid layout: 2 Rows × 4 Columns • 1800 × 1200 px @ 300 DPI
                  </p>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/50">
                <CardContent className="p-4 flex gap-4 items-start">
                  <Printer className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Print Ready</h4>
                    <p className="text-xs text-muted-foreground">Formatted exactly for standard 4x6 inch photo paper at 300 DPI.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/50">
                <CardContent className="p-4 flex gap-4 items-start">
                  <Settings2 className="h-5 w-5 text-secondary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Custom Controls</h4>
                    <p className="text-xs text-muted-foreground">Adjust margins, spacing, and photo scaling for the perfect fit.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border-none shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle>Grid Settings</CardTitle>
                <CardDescription>Adjust the print layout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold">Sheet Margins</Label>
                    <span className="text-xs text-muted-foreground">{Math.round((margin / DPI) * 25.4)} mm</span>
                  </div>
                  <Slider 
                    value={[margin]} 
                    min={0} 
                    max={100} 
                    step={1} 
                    onValueChange={(v) => setMargin(v[0])}
                    disabled={!sourceImage}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold">Photo Spacing</Label>
                    <span className="text-xs text-muted-foreground">{Math.round((spacing / DPI) * 25.4)} mm</span>
                  </div>
                  <Slider 
                    value={[spacing]} 
                    min={0} 
                    max={100} 
                    step={1} 
                    onValueChange={(v) => setSpacing(v[0])}
                    disabled={!sourceImage}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-semibold">Photo Scaling</Label>
                    <span className="text-xs text-muted-foreground">{photoScale}%</span>
                  </div>
                  <Slider 
                    value={[photoScale]} 
                    min={50} 
                    max={150} 
                    step={1} 
                    onValueChange={(v) => setPhotoScale(v[0])}
                    disabled={!sourceImage}
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-y">
                  <Label htmlFor="borders" className="text-sm font-semibold cursor-pointer">Show Cut Borders</Label>
                  <Switch 
                    id="borders" 
                    checked={showBorders} 
                    onCheckedChange={setShowBorders} 
                    disabled={!sourceImage}
                  />
                </div>

                <div className="pt-6 space-y-3">
                  <Button 
                    className="w-full h-12 text-lg font-bold" 
                    onClick={downloadPNG}
                    disabled={!sourceImage}
                  >
                    <ImageIcon className="mr-2 h-5 w-5" /> Download PNG
                  </Button>
                  <Button 
                    variant="secondary"
                    className="w-full h-12 text-lg font-bold" 
                    onClick={downloadPDF}
                    disabled={!sourceImage}
                  >
                    <FileText className="mr-2 h-5 w-5" /> Download PDF
                  </Button>
                  
                  {sourceImage && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-destructive hover:bg-destructive/10" 
                      onClick={reset}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Reset Grid
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