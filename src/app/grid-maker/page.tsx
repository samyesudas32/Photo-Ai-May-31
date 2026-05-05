
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
  X,
  FileImage,
  ShieldCheck,
  CheckCircle2,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// GRID SPECS (4x2)
const COLS = 4;
const ROWS = 2;
const TOTAL_SLOTS = COLS * ROWS;

// CALCULATE SLOT DIMENSIONS based on uniform margins and gaps (0.52cm)
const SLOT_WIDTH = (CANVAS_WIDTH - (SPACING_PX * (COLS + 1))) / COLS;
const SLOT_HEIGHT = (CANVAS_HEIGHT - (SPACING_PX * (ROWS + 1))) / ROWS;

export default function GridMakerPage() {
  const [slots, setSlots] = useState<(string | null)[]>(Array(TOTAL_SLOTS).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  
  // Targeted Distribution State
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [targetSlotString, setTargetSlotString] = useState("");
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
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
          setSlots(newSlots);
          
          toast({
            title: "Photo Added",
            description: `Placed in slot ${activeSlot + 1}.`,
          });
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = "";
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setBulkFiles(Array.from(e.target.files).filter(f => f.type.startsWith("image/")));
    }
  };

  const handleProcessBulk = async () => {
    const targetIndices = targetSlotString
      .split(',')
      .map(s => parseInt(s.trim()) - 1)
      .filter(n => !isNaN(n) && n >= 0 && n < TOTAL_SLOTS);

    if (targetIndices.length === 0) {
      toast({
        variant: "destructive",
        title: "Invalid Slots",
        description: "Please enter valid slot numbers (1-8).",
      });
      return;
    }

    if (bulkFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "No Photos",
        description: "Please select photos to upload.",
      });
      return;
    }

    const newSlots = [...slots];
    const fileLoadPromises = bulkFiles.slice(0, targetIndices.length).map((file, idx) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          newSlots[targetIndices[idx]] = reader.result as string;
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    await Promise.all(fileLoadPromises);
    setSlots(newSlots);
    setIsDistributionOpen(false);
    setTargetSlotString("");
    setBulkFiles([]);
    
    toast({
      title: "Bulk Distribution Complete",
      description: `Updated ${fileLoadPromises.length} assigned slots.`,
    });
  };

  const handleRemove = (index: number) => {
    const newSlots = [...slots];
    newSlots[index] = null;
    
    // Vertical Logic: If a photo in the top row (0-3) is removed, 
    // the one below it (index + 4) is also removed.
    if (index < 4) {
      newSlots[index + 4] = null;
    }
    
    setSlots(newSlots);
    toast({
      title: "Photo Removed",
      description: "Slot cleared according to vertical alignment logic.",
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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    slots.forEach((uri, i) => {
      if (!uri) return;

      const col = i % COLS;
      const row = Math.floor(i / COLS);
      
      const x = Math.round(SPACING_PX + col * (SLOT_WIDTH + SPACING_PX));
      const y = Math.round(SPACING_PX + row * (SLOT_HEIGHT + SPACING_PX));

      const img = new window.Image();
      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, SLOT_WIDTH, SLOT_HEIGHT);
        ctx.clip();

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

        drawX = Math.round(x + (SLOT_WIDTH - drawW) / 2);
        drawY = Math.round(y + (SLOT_HEIGHT - drawH) / 2);

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        
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

  const downloadJPG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-hd-print-sheet.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 1.0);
    link.click();
  };

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-hd-print-sheet.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const downloadPDF = () => {
    if (!canvasRef.current) return;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "in",
      format: [6, 4]
    });
    const imgData = canvasRef.current.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, 6, 4);
    pdf.save(`pixelpass-hd-print-sheet.pdf`);
  };

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
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Grid3X3 className="h-8 w-8" /> HD Print Setup
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Use individual slots, or input multiple slot numbers below for bulk distribution. The final 4×2 grid maintains absolute 0.52cm margins for printing.
            </p>
          </div>
          
          <Dialog open={isDistributionOpen} onOpenChange={setIsDistributionOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white font-bold rounded-full shadow-lg">
                <Layers className="mr-2 h-4 w-4" /> Targeted Distribution
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Targeted Slot Distribution</DialogTitle>
                <DialogDescription>
                  Enter destination slot number(s) and select photos for bulk assignment.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="slots-input" className="text-sm font-semibold">
                    Enter Destination Slot Number(s) (e.g., 2, 5, 6):
                  </Label>
                  <Input 
                    id="slots-input"
                    placeholder="2, 5, 6"
                    value={targetSlotString}
                    onChange={(e) => setTargetSlotString(e.target.value)}
                    className="border-2 focus-visible:ring-primary"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Select Photos for Assigned Slots:</Label>
                  <div 
                    className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => bulkInputRef.current?.click()}
                  >
                    <Plus className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">
                      {bulkFiles.length > 0 ? `${bulkFiles.length} photos selected` : "Select Photos for Assigned Slots:"}
                    </p>
                    <input 
                      type="file" 
                      multiple 
                      ref={bulkInputRef}
                      className="hidden" 
                      onChange={handleBulkFileChange}
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleProcessBulk} 
                  className="w-full bg-primary hover:bg-primary/90 font-bold h-12"
                >
                  Process and Upload to Selected Slots
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" /> Grid Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-4 gap-3">
                  {slots.map((uri, i) => (
                    <div key={i} className="space-y-1">
                      <button
                        onClick={() => handleSlotClick(i)}
                        className={cn(
                          "aspect-[35/45] w-full border-2 border-dashed rounded-xl flex items-center justify-center relative overflow-hidden transition-all hover:border-primary/50 group",
                          uri ? "border-solid border-primary bg-white shadow-sm" : "bg-muted/30 border-muted"
                        )}
                      >
                        {uri ? (
                          <Image src={uri} alt={`Slot ${i+1}`} fill className="object-cover" />
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                        <div className="absolute top-1 right-1">
                           <span className="text-[9px] font-black bg-black/60 text-white px-1.5 rounded-sm">{i + 1}</span>
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
                  <div className="grid grid-cols-1 gap-3">
                    <Button 
                      className="font-bold shadow-md h-12 bg-secondary hover:bg-secondary/90 relative" 
                      onClick={downloadPNG}
                      disabled={!slots.some(s => s !== null)}
                    >
                      <Download className="mr-2 h-4 w-4" /> HD Lossless PNG
                      <span className="absolute -top-2 -right-2 bg-green-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black">HD</span>
                    </Button>
                    <Button 
                      className="font-bold shadow-md h-12 relative" 
                      onClick={downloadJPG}
                      disabled={!slots.some(s => s !== null)}
                    >
                      <FileImage className="mr-2 h-4 w-4" /> HD Maximum JPG
                      <span className="absolute -top-2 -right-2 bg-green-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black">HD</span>
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 font-bold border-2 relative" 
                    onClick={downloadPDF}
                    disabled={!slots.some(s => s !== null)}
                  >
                    <FileText className="mr-2 h-5 w-5" /> Export HD PDF (6x4in)
                    <span className="absolute -top-2 -right-2 bg-green-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black">HD</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-destructive hover:bg-destructive/10" 
                    onClick={resetCanvas}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Reset All Slots
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
            
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <h4 className="text-xs font-black uppercase text-primary mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> Print Optimized
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                6x4 INCH • 300 DPI • LOSSLESS HD EXPORT. Gaps and margins are strictly fixed at 0.52cm.
              </p>
            </div>
          </div>

          <div className="lg:col-span-8">
            <Card className="bg-slate-50 border-none flex flex-col items-center justify-center p-8 min-h-[600px] relative">
              <div className="relative shadow-2xl bg-white p-0">
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
                      <h3 className="text-lg font-bold text-slate-400 uppercase tracking-tighter">Canvas Empty</h3>
                      <p className="text-xs text-slate-400 max-w-xs font-medium">Use Targeted Distribution or click individual slots to begin.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-xl">
                {[
                  { label: "Format", val: "6 x 4 in" },
                  { label: "Resolution", val: "300 DPI" },
                  { label: "Spacing", val: "0.52 cm" },
                  { label: "Quality", val: "HD Export" }
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
