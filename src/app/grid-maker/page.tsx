
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Upload, 
  Download, 
  ArrowLeft, 
  Grid3X3, 
  FileText, 
  Trash2,
  Plus,
  Camera,
  FileImage,
  Layers,
  Settings2,
  Save,
  Ruler,
  LayoutGrid
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
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  setDocumentNonBlocking,
  useCollection
} from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// CONSTANTS
const DPI = 300;
const CM_TO_PX = DPI / 2.54;
const SPACING_PX = Math.round(0.52 * CM_TO_PX); // ~61px (0.52cm)

interface CustomSize {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
}

export default function GridMakerPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  // Canvas & Grid State
  const [canvasDim, setCanvasDim] = useState({ width: 6, height: 4 }); // In inches
  const [numCols, setNumCols] = useState(4);
  const [numRows, setNumRows] = useState(2);
  const [selectedSizeId, setSelectedSizeId] = useState<string>('default-passport');
  
  const totalSlots = numCols * numRows;
  const [slots, setSlots] = useState<(string | null)[]>([]);

  // Initialize slots when grid dimensions change
  useEffect(() => {
    setSlots(prev => {
      const newSlots = Array(totalSlots).fill(null);
      // Try to preserve existing photos if possible
      prev.forEach((val, i) => {
        if (i < totalSlots) newSlots[i] = val;
      });
      return newSlots;
    });
  }, [totalSlots]);

  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [targetSlotString, setTargetSlotString] = useState("");
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  // Load User Data
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<any>(userProfileRef);

  const customSizesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'custom_passport_sizes'), orderBy('order', 'asc'));
  }, [db, user]);

  const { data: customSizes } = useCollection<CustomSize>(customSizesQuery);

  useEffect(() => {
    if (profile?.preferredCanvasSize) {
      setCanvasDim(profile.preferredCanvasSize);
    }
  }, [profile]);

  // Derived Pixel Dimensions
  const canvasWidthPx = useMemo(() => Math.round(canvasDim.width * DPI), [canvasDim.width]);
  const canvasHeightPx = useMemo(() => Math.round(canvasDim.height * DPI), [canvasDim.height]);
  
  // Calculate Slot Dimensions based on Physical Photo Size
  const currentPhotoSize = useMemo(() => {
    const size = customSizes?.find(s => s.id === selectedSizeId);
    if (size) return { widthCm: size.widthCm, heightCm: size.heightCm };
    if (selectedSizeId === 'default-passport') return { widthCm: 3.5, heightCm: 4.5 };
    if (selectedSizeId === 'default-stamp') return { widthCm: 2.0, heightCm: 2.5 };
    if (selectedSizeId === 'default-pan') return { widthCm: 2.5, heightCm: 3.5 };
    return { widthCm: 3.5, heightCm: 4.5 };
  }, [customSizes, selectedSizeId]);

  const slotWidth = useMemo(() => Math.round(currentPhotoSize.widthCm * CM_TO_PX), [currentPhotoSize]);
  const slotHeight = useMemo(() => Math.round(currentPhotoSize.heightCm * CM_TO_PX), [currentPhotoSize]);

  // Helper: Get indices of the same column (Vertical Synchronization)
  const getColumnIndices = useCallback((index: number) => {
    const colIndex = index % numCols;
    const indices = [];
    for (let r = 0; r < numRows; r++) {
      indices.push(r * numCols + colIndex);
    }
    return indices;
  }, [numCols, numRows]);

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
          const colIndices = getColumnIndices(activeSlot);
          
          colIndices.forEach(idx => {
            newSlots[idx] = newData;
          });
          
          setSlots(newSlots);
          toast({ title: "Column Updated", description: "Column synced vertically." });
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
      .filter(n => !isNaN(n) && n >= 0 && n < totalSlots);

    if (targetIndices.length === 0 || bulkFiles.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Invalid inputs." });
      return;
    }

    const newSlots = [...slots];
    const loadedFiles = await Promise.all(bulkFiles.map(file => {
      return new Promise<{data: string}>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve({ data: reader.result as string });
        reader.readAsDataURL(file);
      });
    }));

    targetIndices.forEach((targetIndex, idx) => {
      const data = loadedFiles[idx]?.data || loadedFiles[0].data;
      const colIndices = getColumnIndices(targetIndex);
      colIndices.forEach(colIdx => {
        newSlots[colIdx] = data;
      });
    });

    setSlots(newSlots);
    setIsDistributionOpen(false);
    setTargetSlotString("");
    setBulkFiles([]);
    toast({ title: "Bulk Distribution Complete", description: "Columns populated vertically." });
  };

  const handleRemove = (index: number) => {
    const newSlots = [...slots];
    newSlots[index] = null; // Removed one-by-one as requested in previous step
    setSlots(newSlots);
  };

  const saveCanvasSettings = () => {
    if (user && db) {
      setDocumentNonBlocking(doc(db, 'users', user.uid), {
        preferredCanvasSize: canvasDim,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "Settings Saved", description: "Canvas preferences updated." });
    }
    setIsSettingsOpen(false);
  };

  const drawCanvas = useCallback(async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvasWidthPx, canvasHeightPx);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

    const images = await Promise.all(slots.map(uri => {
      if (!uri) return Promise.resolve(null);
      return new Promise<HTMLImageElement | null>(resolve => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = uri;
      });
    }));

    // TOP-LEFT ALIGNMENT: 0.52cm margins
    const offsetX = SPACING_PX; 
    const offsetY = SPACING_PX;

    images.forEach((img, i) => {
      if (!img) return;
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const x = Math.round(offsetX + col * (slotWidth + SPACING_PX));
      const y = Math.round(offsetY + row * (slotHeight + SPACING_PX));

      // Clip to canvas boundaries
      if (x + slotWidth > canvasWidthPx || y + slotHeight > canvasHeightPx) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, slotWidth, slotHeight);
      ctx.clip();

      const imgAspect = img.width / img.height;
      const slotAspect = slotWidth / slotHeight;
      let dW, dH, dX, dY;

      if (imgAspect > slotAspect) {
        dH = slotHeight; dW = dH * imgAspect;
      } else {
        dW = slotWidth; dH = dW / imgAspect;
      }

      dX = Math.round(x + (slotWidth - dW) / 2);
      dY = Math.round(y + (slotHeight - dH) / 2);
      
      ctx.drawImage(img, dX, dY, dW, dH);
      
      // Professional 3px Black Stroke (Border-box)
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, slotWidth - 3, slotHeight - 3);
      ctx.restore();
    });
  }, [slots, canvasWidthPx, canvasHeightPx, slotWidth, slotHeight, numCols, numRows]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const downloadJPG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-hd-sheet.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 1.0);
    link.click();
  };

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-hd-sheet.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const downloadPDF = () => {
    if (!canvasRef.current) return;
    const pdf = new jsPDF({
      orientation: canvasDim.width > canvasDim.height ? "landscape" : "portrait",
      unit: "in",
      format: [canvasDim.width, canvasDim.height]
    });
    pdf.addImage(canvasRef.current.toDataURL("image/png"), "PNG", 0, 0, canvasDim.width, canvasDim.height);
    pdf.save(`pixelpass-hd-sheet.pdf`);
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
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
              <Grid3X3 className="h-8 w-8" /> HD Grid Setup
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Sheet: {canvasDim.width}x{canvasDim.height}in • Photo: {currentPhotoSize.widthCm}x{currentPhotoSize.heightCm}cm • Gap: 0.52cm
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full shadow-sm">
                  <Settings2 className="mr-2 h-4 w-4" /> Canvas Format
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Physical Canvas Bounds</DialogTitle>
                  <DialogDescription>Set the paper size in inches for high-fidelity rendering.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-width">Width (in)</Label>
                    <Input 
                      id="c-width" 
                      type="number" 
                      value={canvasDim.width} 
                      onChange={(e) => setCanvasDim({...canvasDim, width: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-height">Height (in)</Label>
                    <Input 
                      id="c-height" 
                      type="number" 
                      value={canvasDim.height} 
                      onChange={(e) => setCanvasDim({...canvasDim, height: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={saveCanvasSettings} className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Preferences
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDistributionOpen} onOpenChange={setIsDistributionOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white font-bold rounded-full shadow-lg">
                  <Layers className="mr-2 h-4 w-4" /> Targeted Distribution
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Targeted Slot Distribution</DialogTitle>
                  <DialogDescription>Input slot numbers (e.g. 1, 3, 4). Columns sync automatically.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Target Slots (1-{totalSlots}):</Label>
                    <Input 
                      placeholder="e.g., 2, 5, 6" 
                      value={targetSlotString} 
                      onChange={(e) => setTargetSlotString(e.target.value)}
                    />
                  </div>
                  <div 
                    className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => bulkInputRef.current?.click()}
                  >
                    <Plus className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs font-medium">
                      {bulkFiles.length > 0 ? `${bulkFiles.length} photos selected` : "Select Photos for Assigned Slots"}
                    </p>
                    <input type="file" multiple ref={bulkInputRef} className="hidden" onChange={handleBulkFileChange} accept="image/*" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleProcessBulk} className="w-full h-12">Distribute and Update Columns</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary" /> Grid Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Columns</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={12} 
                      value={numCols} 
                      onChange={(e) => setNumCols(Math.max(1, parseInt(e.target.value) || 1))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Rows</Label>
                    <Input 
                      type="number" 
                      min={1} 
                      max={12} 
                      value={numRows} 
                      onChange={(e) => setNumRows(Math.max(1, parseInt(e.target.value) || 1))}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Photo Size</Label>
                  <Select value={selectedSizeId} onValueChange={setSelectedSizeId}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Select photo size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default-passport">Passport (3.5 x 4.5 cm)</SelectItem>
                      <SelectItem value="default-stamp">Stamp Size (2.0 x 2.5 cm)</SelectItem>
                      <SelectItem value="default-pan">PAN Card (2.5 x 3.5 cm)</SelectItem>
                      {customSizes?.map(size => (
                        <SelectItem key={size.id} value={size.id}>{size.name} ({size.widthCm}x{size.heightCm}cm)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Interactive Portions ({numCols}x{numRows})</Label>
                  <div 
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${numCols}, 1fr)` }}
                  >
                    {slots.map((uri, i) => (
                      <div key={i} className="relative group">
                        <button
                          onClick={() => handleSlotClick(i)}
                          className={cn(
                            "aspect-[35/45] w-full border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden transition-all bg-muted/10 hover:border-primary/50",
                            uri ? "border-solid border-primary bg-white shadow-sm" : "border-muted"
                          )}
                        >
                          {uri ? <Image src={uri} alt={`S${i+1}`} fill className="object-cover" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                          <span className="absolute top-1 right-1 text-[8px] font-black bg-black/60 text-white px-1 rounded-sm">{i + 1}</span>
                        </button>
                        {uri && (
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-5 w-5 rounded-full absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 shadow-lg transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t space-y-3">
                  <Button className="w-full h-12 font-bold bg-secondary hover:bg-secondary/90 shadow-md text-white" onClick={downloadPNG} disabled={!slots.some(s => s)}>
                    <Download className="mr-2 h-4 w-4" /> Download HD PNG
                  </Button>
                  <Button className="w-full h-12 font-bold shadow-md" onClick={downloadJPG} disabled={!slots.some(s => s)}>
                    <FileImage className="mr-2 h-4 w-4" /> Download HD JPG
                  </Button>
                  <Button variant="outline" className="w-full h-12 font-bold border-2" onClick={downloadPDF} disabled={!slots.some(s => s)}>
                    <FileText className="mr-2 h-5 w-5" /> Download HD PDF
                  </Button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8">
            <Card className="bg-slate-100 border-none flex flex-col items-center justify-center p-8 min-h-[600px] rounded-3xl overflow-hidden">
              <div className="relative shadow-2xl bg-white rounded-sm overflow-hidden border-8 border-white/50">
                <div 
                  className="relative bg-white shadow-inner"
                  style={{ 
                    width: '600px', 
                    height: `${(600 / canvasDim.width) * canvasDim.height}px`,
                  }}
                >
                  <canvas ref={canvasRef} width={canvasWidthPx} height={canvasHeightPx} className="absolute inset-0 w-full h-full" />
                  {!slots.some(s => s) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
                      <Camera className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-40">Ready for Alignment</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { label: "HD Sheet", val: `${canvasDim.width} x ${canvasDim.height} in` },
                  { label: "Resolution", val: "300 DPI" },
                  { label: "Photo Format", val: `${currentPhotoSize.widthCm} x ${currentPhotoSize.heightCm} cm` },
                  { label: "Grid Symmetry", val: `${numCols}x${numRows}` }
                ].map((spec, i) => (
                  <div key={i} className="text-center group">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest transition-colors group-hover:text-primary">{spec.label}</p>
                    <p className="text-xs font-bold text-slate-900">{spec.val}</p>
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
