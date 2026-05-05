
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
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
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

// PHOTO DIMENSIONS (Standard Passport: 3.5cm x 4.5cm)
const PHOTO_WIDTH_CM = 3.5;
const PHOTO_HEIGHT_CM = 4.5;
const PHOTO_WIDTH_PX = Math.round((PHOTO_WIDTH_CM / 2.54) * DPI); // ~413px
const PHOTO_HEIGHT_PX = Math.round((PHOTO_HEIGHT_CM / 2.54) * DPI); // ~531px

// SPACING
const GRID_GAP_CM = 0.52;
const GRID_GAP_PX = Math.round((GRID_GAP_CM / 2.54) * DPI); // ~61px
const WHITE_BORDER_CM = 0.3;
const WHITE_BORDER_PX = Math.round((WHITE_BORDER_CM / 2.54) * DPI); // ~35px

interface PhotoSlot {
  id: number;
  imageUri: string | null;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export default function GridMakerPage() {
  const [slots, setSlots] = useState<PhotoSlot[]>(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      imageUri: null,
      zoom: 100,
      offsetX: 0,
      offsetY: 0,
    }))
  );
  
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const updateSlot = (index: number, updates: Partial<PhotoSlot>) => {
    setSlots(prev => {
      const newSlots = [...prev];
      const isTopRow = index < 4;
      const linkedIndex = isTopRow ? index + 4 : index - 4;

      newSlots[index] = { ...newSlots[index], ...updates };
      newSlots[linkedIndex] = { ...newSlots[linkedIndex], ...updates };

      return newSlots;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedSlotIndex !== null) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          updateSlot(selectedSlotIndex, { 
            imageUri: reader.result as string,
            zoom: 100,
            offsetX: 0,
            offsetY: 0
          });
          toast({
            title: "Photo Added",
            description: `Column updated for high-precision printing.`,
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

    const cols = 4;
    const rows = 2;

    const slotWidth = PHOTO_WIDTH_PX + (WHITE_BORDER_PX * 2);
    const slotHeight = PHOTO_HEIGHT_PX + (WHITE_BORDER_PX * 2);

    const totalGridWidth = (slotWidth * cols) + (GRID_GAP_PX * (cols - 1));
    const totalGridHeight = (slotHeight * rows) + (GRID_GAP_PX * (rows - 1));
    const startX = (CANVAS_WIDTH - totalGridWidth) / 2;
    const startY = (CANVAS_HEIGHT - totalGridHeight) / 2;

    slots.forEach((slot, index) => {
      const c = index % cols;
      const r = Math.floor(index / cols);

      const x = startX + c * (slotWidth + GRID_GAP_PX);
      const y = startY + r * (slotHeight + GRID_GAP_PX);

      // Draw White Slot background (No black border)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x, y, slotWidth, slotHeight);

      const imageAreaX = x + WHITE_BORDER_PX;
      const imageAreaY = y + WHITE_BORDER_PX;

      if (slot.imageUri) {
        const img = new window.Image();
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(imageAreaX, imageAreaY, PHOTO_WIDTH_PX, PHOTO_HEIGHT_PX);
          ctx.clip();

          const imgAspect = img.width / img.height;
          const areaAspect = PHOTO_WIDTH_PX / PHOTO_HEIGHT_PX;
          
          let drawW, drawH;
          if (imgAspect > areaAspect) {
            drawH = PHOTO_HEIGHT_PX * (slot.zoom / 100);
            drawW = drawH * imgAspect;
          } else {
            drawW = PHOTO_WIDTH_PX * (slot.zoom / 100);
            drawH = drawW / imgAspect;
          }

          const drawX = imageAreaX + (PHOTO_WIDTH_PX - drawW) / 2 + slot.offsetX;
          const drawY = imageAreaY + (PHOTO_HEIGHT_PX - drawH) / 2 + slot.offsetY;

          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        };
        img.src = slot.imageUri;
      } else {
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(imageAreaX, imageAreaY, PHOTO_WIDTH_PX, PHOTO_HEIGHT_PX);
        ctx.fillStyle = "#CBD5E1";
        ctx.font = "bold 14px Inter";
        ctx.textAlign = "center";
        ctx.fillText("EMPTY SLOT", imageAreaX + PHOTO_WIDTH_PX / 2, imageAreaY + PHOTO_HEIGHT_PX / 2 + 5);
      }
    });
  }, [slots]);

  useEffect(() => {
    const timeout = setTimeout(drawGrid, 100);
    return () => clearTimeout(timeout);
  }, [drawGrid]);

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-precision-grid.${format}`;
    link.href = canvasRef.current.toDataURL(`image/${format}`, 1.0);
    link.click();
    toast({ title: "Success", description: "High-resolution sheet saved." });
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
    pdf.save(`pixelpass-precision-sheet.pdf`);
    toast({ title: "PDF Ready", description: "Standard 6x4in print document generated." });
  };

  const resetAll = () => {
    setSlots(Array.from({ length: 8 }, (_, i) => ({
      id: i,
      imageUri: null,
      zoom: 100,
      offsetX: 0,
      offsetY: 0,
    })));
    setSelectedSlotIndex(null);
  };

  const selectedSlot = selectedSlotIndex !== null ? slots[selectedSlotIndex] : null;

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
            <h1 className="text-3xl font-bold tracking-tight">Precision Sheet Generator</h1>
            <p className="text-muted-foreground text-sm font-medium">6x4 inch @ 300 DPI • Vertical Sync Active</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RefreshCw className="h-4 w-4 mr-2" /> Reset All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" /> Sheet Controls
                </CardTitle>
                <CardDescription>Click a slot on the preview to adjust its column.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {selectedSlotIndex !== null && selectedSlot ? (
                  <div className="space-y-6 animate-in slide-in-from-left-2">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">Column { (selectedSlotIndex % 4) + 1 }</span>
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase text-primary bg-white px-2 py-0.5 rounded border">
                          <LinkIcon className="h-3 w-3" /> Linked
                        </div>
                      </div>
                      
                      <Button className="w-full" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> 
                        {selectedSlot.imageUri ? "Update Image" : "Upload Image"}
                      </Button>
                      
                      {selectedSlot.imageUri && (
                        <div className="space-y-4 pt-4 border-t border-primary/10">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs font-bold uppercase">Zoom</span>
                              <span className="text-[10px] font-mono">{selectedSlot.zoom}%</span>
                            </div>
                            <Slider 
                              value={[selectedSlot.zoom]} 
                              min={50} 
                              max={300} 
                              onValueChange={(v) => updateSlot(selectedSlotIndex, { zoom: v[0] })} 
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">X-Shift</span>
                              <Slider 
                                value={[selectedSlot.offsetX]} 
                                min={-300} 
                                max={300} 
                                onValueChange={(v) => updateSlot(selectedSlotIndex, { offsetX: v[0] })} 
                              />
                            </div>
                            <div className="space-y-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">Y-Shift</span>
                              <Slider 
                                value={[selectedSlot.offsetY]} 
                                min={-300} 
                                max={300} 
                                onValueChange={(v) => updateSlot(selectedSlotIndex, { offsetY: v[0] })} 
                              />
                            </div>
                          </div>
                          
                          <Button 
                            variant="ghost" 
                            className="w-full text-destructive hover:bg-destructive/10 h-8 text-xs"
                            onClick={() => updateSlot(selectedSlotIndex, { imageUri: null })}
                          >
                            <Trash2 className="h-3 w-3 mr-2" /> Clear Column
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
                    <ImageIcon className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-sm text-muted-foreground font-medium max-w-[200px]">
                      Select a slot to start building your sheet.
                    </p>
                  </div>
                )}

                <div className="pt-6 border-t space-y-3">
                  <Button className="w-full font-bold shadow-lg" onClick={() => downloadImage('jpeg')}>
                    <Download className="mr-2 h-4 w-4" /> Download JPG (Print)
                  </Button>
                  <Button variant="outline" className="w-full font-bold" onClick={downloadPDF}>
                    <FileText className="mr-2 h-4 w-4" /> Export PDF
                  </Button>
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*" 
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-slate-50 border-2 flex flex-col items-center justify-center min-h-[700px] relative shadow-inner p-4 md:p-12">
              <div className="w-full flex flex-col items-center">
                <div className="relative">
                  <div className="absolute -inset-8 bg-black/5 blur-3xl rounded-[3rem] -z-10"></div>
                  
                  <div className="relative bg-white p-4 shadow-2xl rounded-sm border ring-1 ring-black/10 overflow-hidden cursor-crosshair">
                    <canvas 
                      ref={canvasRef} 
                      width={CANVAS_WIDTH} 
                      height={CANVAS_HEIGHT} 
                      className="hidden"
                    />

                    <div 
                      className="grid grid-cols-4 grid-rows-2"
                      style={{ 
                        gap: `${(GRID_GAP_PX / CANVAS_WIDTH) * 100}%`,
                        width: '700px',
                        maxWidth: '100%',
                        aspectRatio: '6/4',
                        display: 'grid'
                      }}
                    >
                      {slots.map((slot, i) => (
                        <div 
                          key={slot.id}
                          className={cn(
                            "relative aspect-[3.5/4.5] group transition-all duration-300 bg-white",
                            selectedSlotIndex === i ? "ring-4 ring-primary ring-offset-2 z-10" : "hover:ring-2 hover:ring-primary/40"
                          )}
                          onClick={() => setSelectedSlotIndex(i)}
                        >
                          <div className="absolute inset-0 overflow-hidden">
                            {slot.imageUri ? (
                              <ImageWithCrop slot={slot} />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 text-slate-300 group-hover:text-primary/40 transition-colors">
                                <Plus className="h-8 w-8 mb-1" />
                                <span className="text-[8px] font-black uppercase tracking-widest">SLOT {i + 1}</span>
                              </div>
                            )}
                            
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                                <LinkIcon className="h-2 w-2" />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-2xl border-t pt-8">
                  {[
                    { label: "Canvas", val: "6 x 4 in" },
                    { label: "Precision", val: "300 DPI" },
                    { label: "Gap", val: "0.52 cm" },
                    { label: "Sync", val: "Vertical" }
                  ].map((spec, i) => (
                    <div key={i} className="text-center space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{spec.label}</p>
                      <p className="text-sm font-bold text-primary">{spec.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function ImageWithCrop({ slot }: { slot: PhotoSlot }) {
  return (
    <div className="w-full h-full relative overflow-hidden bg-white">
      {slot.imageUri && (
        <img 
          src={slot.imageUri} 
          alt="Cropped"
          className="absolute max-w-none transition-transform duration-75 pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${slot.zoom / 100}) translate(${slot.offsetX}px, ${slot.offsetY}px)`,
          }}
        />
      )}
      {/* Simulation of white bleed margin */}
      <div 
        className="absolute inset-0 pointer-events-none ring-[12px] ring-white"
      />
    </div>
  );
}
