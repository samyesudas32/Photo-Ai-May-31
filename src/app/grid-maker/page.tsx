
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Upload, 
  Download, 
  ArrowLeft, 
  Grid3X3, 
  FileText, 
  Trash2,
  Plus,
  Camera,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { cn } from "@/lib/utils";
import Image from "next/image";

// PRINT SPECIFICATIONS (6x4in @ 300DPI)
const DPI = 300;
const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1200;

// SPACING (0.52cm)
const CM_TO_PX = 300 / 2.54;
const SPACING_PX = Math.round(0.52 * CM_TO_PX); // ~61px

// GRID SPECS
const COLS = 4;
const ROWS = 2;
const TOTAL_SLOTS = COLS * ROWS;

// CALCULATE SLOT DIMENSIONS
// Width: (1800 - (2 * Margin) - ((COLS - 1) * Gap)) / COLS
// (1800 - 122 - 183) / 4 = 1495 / 4 = 373.75
const SLOT_WIDTH = (CANVAS_WIDTH - (2 * SPACING_PX) - ((COLS - 1) * SPACING_PX)) / COLS;
// Height: (1200 - (2 * Margin) - ((ROWS - 1) * Gap)) / ROWS
// (1200 - 122 - 61) / 2 = 1017 / 2 = 508.5
const SLOT_HEIGHT = (CANVAS_HEIGHT - (2 * SPACING_PX) - ((ROWS - 1) * SPACING_PX)) / ROWS;

export default function GridMakerPage() {
  const [slots, setSlots] = useState<(string | null)[]>(Array(TOTAL_SLOTS).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSlotClick = (index: number) => {
    setActiveSlot(index);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeSlot !== null) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const newData = reader.result as string;
          const newSlots = [...slots];
          newSlots[activeSlot] = newData;
          
          // Pattern logic: If top row is filled, we could sync downwards, 
          // but the prompt focuses on removal logic. 
          // However, for UX, if a user clicks a slot we just fill that slot.
          setSlots(newSlots);
          
          toast({
            title: "Photo Added",
            description: `Placed in slot ${activeSlot + 1}.`,
          });
        };
        reader.readAsDataURL(file);
      }
    }
    // Reset input so the same file can be picked again for different slots
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    const newSlots = [...slots];
    newSlots[index] = null;
    
    // Logic: When a photo is removed, all photos below it should also be removed.
    // In our 4x2 grid, index 0-3 are top, 4-7 are bottom.
    if (index < 4) {
      newSlots[index + 4] = null;
    }
    
    setSlots(newSlots);
    toast({
      title: "Photo Removed",
      description: "Slot cleared according to vertical rules.",
    });
  };

  const resetCanvas = () => {
    setSlots(Array(TOTAL_SLOTS).fill(null));
    toast({ title: "Canvas Reset", description: "All slots cleared." });
  };

  const drawCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    slots.forEach((uri, i) => {
      if (!uri) return;

      const col = i % COLS;
      const row = Math.floor(i / COLS);
      
      const x = SPACING_PX + col * (SLOT_WIDTH + SPACING_PX);
      const y = SPACING_PX + row * (SLOT_HEIGHT + SPACING_PX);

      const img = new window.Image();
      img.onload = () => {
        ctx.save();
        // Clipping region for slot
        ctx.beginPath();
        ctx.rect(x, y, SLOT_WIDTH, SLOT_HEIGHT);
        ctx.clip();

        // Maintain aspect ratio (Cover)
        const imgAspect = img.width / img.height;
        const slotAspect = SLOT_WIDTH / SLOT_HEIGHT;
        let drawW, drawH, drawX, drawY;

        if (imgAspect > slotAspect) {
          drawH = SLOT_HEIGHT;
          drawW = drawH * imgAspect;
        } else {
          drawW = SLOT_WIDTH;
          drawH = drawW / imgAspect;
        }

        drawX = x + (SLOT_WIDTH - drawW) / 2;
        drawY = y + (SLOT_HEIGHT - drawH) / 2;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        
        // 3px Black Border (Stroke) - border-box simulation (stroke inside)
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, SLOT_WIDTH - 3, SLOT_HEIGHT - 3);
        
        ctx.restore();
      };
      img.src = uri;
    });
  }, [slots]);

  useEffect(() => {
    const timer = setTimeout(drawCanvas, 100);
    return () => clearTimeout(timer);
  }, [drawCanvas, slots]);

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-print-sheet.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  const downloadPDF = () => {
    if (!canvasRef.current) return;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [6, 4]
    });
    const imgData = canvasRef.current.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData, "JPEG", 0, 0, 6, 4);
    pdf.save(`pixelpass-print-sheet.pdf`);
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
            <p className="text-muted-foreground text-sm font-medium">6x4 INCH • 300 DPI • 0.52CM UNIFORM SPACING</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" /> Print Setup
                </CardTitle>
                <CardDescription>Upload photos to individual slots. The 4x2 grid maintains absolute 0.52cm margins and gaps.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((uri, i) => (
                    <div key={i} className="space-y-1">
                      <button
                        onClick={() => handleSlotClick(i)}
                        className={cn(
                          "aspect-[35/45] w-full border-2 border-dashed rounded-lg flex items-center justify-center relative overflow-hidden transition-all hover:border-primary/50",
                          uri ? "border-solid border-primary bg-white" : "bg-muted/30 border-muted"
                        )}
                      >
                        {uri ? (
                          <Image src={uri} alt={`Slot ${i+1}`} fill className="object-cover" />
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="absolute top-0 right-0 p-1">
                           <span className="text-[8px] font-black bg-black text-white px-1 rounded">{i + 1}</span>
                        </div>
                      </button>
                      {uri && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-full text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(i);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t space-y-3">
                  <Button 
                    className="w-full h-12 font-bold shadow-lg" 
                    onClick={downloadImage}
                    disabled={!slots.some(s => s !== null)}
                  >
                    <Download className="mr-2 h-5 w-5" /> Download JPG
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 font-bold" 
                    onClick={downloadPDF}
                    disabled={!slots.some(s => s !== null)}
                  >
                    <FileText className="mr-2 h-5 w-5" /> Export PDF
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-destructive hover:bg-destructive/10" 
                    onClick={resetCanvas}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Clear All Slots
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
            
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <h4 className="text-xs font-black uppercase text-primary mb-2">Vertical Rule</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Removing a photo from the top row automatically removes the photo directly beneath it in the bottom row to maintain vertical alignment logic.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <Card className="bg-slate-50 border-none flex flex-col items-center justify-center p-8 min-h-[600px] relative overflow-hidden">
              {/* CANVAS PREVIEW AREA */}
              <div className="relative shadow-2xl bg-white p-0 leading-[0]">
                {/* 
                  Visual preview scaled down for screen display. 
                  600x400 fits well on most screens while representing 6x4 ratio.
                */}
                <div 
                  className="relative bg-white overflow-hidden border border-slate-200"
                  style={{ 
                    width: '600px', 
                    height: '400px',
                  }}
                >
                  <canvas 
                    ref={canvasRef} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT} 
                    className="absolute inset-0 w-full h-full"
                  />
                  
                  {!slots.some(s => s !== null) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 pointer-events-none">
                      <Camera className="h-16 w-16 text-slate-200 mb-4" />
                      <h3 className="text-lg font-bold text-slate-400">Print Canvas Empty</h3>
                      <p className="text-sm text-slate-400 max-w-xs">Click slots on the left to upload your passport photos.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* TECHNICAL SPECIFICATIONS FOOTER */}
              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-12 w-full max-w-xl">
                {[
                  { label: "Canvas", val: "6 x 4 in" },
                  { label: "Resolution", val: "300 DPI" },
                  { label: "Internal Spacing", val: "0.52 cm" },
                  { label: "Outer Margins", val: "0.52 cm" }
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
