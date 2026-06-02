"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Upload, 
  Download, 
  ArrowLeft, 
  Grid3x3, 
  FileText, 
  Trash2,
  Plus,
  Camera,
  FileImage,
  Layers,
  Ruler,
  LayoutGrid,
  Pencil,
  Loader2,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  GripVertical,
  MousePointer2,
  Undo2,
  Settings2
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  useCollection,
  useAuth,
  deleteDocumentNonBlocking
} from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";

// Dnd Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// CONSTANTS - High Precision Blueprint Defaults (at 300 DPI)
const DEFAULT_DPI = 300;
const BLUEPRINT_GAP_W = 61;
const BLUEPRINT_GAP_H = 88;
const BLUEPRINT_MARGIN_L = 39;
const BLUEPRINT_MARGIN_R = 50;
const BLUEPRINT_MARGIN_T = 63;
const BLUEPRINT_MARGIN_B = 71;

type Unit = 'cm' | 'mm' | 'in' | 'px';

interface CustomSize {
  id: string;
  name: string;
  description: string;
  widthCm: number;
  heightCm: number;
  order: number;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  dpi?: number;
}

interface SlotData {
  id: string; 
  url: string | null;
  sizeId: string;
}

function SortableSlot({ 
  index, 
  slot, 
  activeSlot, 
  onSlotClick, 
  onRemove, 
  onSizeChange, 
  customSizes,
}: { 
  index: number;
  slot: SlotData;
  activeSlot: number | null;
  onSlotClick: (index: number) => void;
  onRemove: (index: number) => void;
  onSizeChange: (index: number, sizeId: string) => void;
  customSizes: CustomSize[] | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1">
      <div
        className={cn(
          "aspect-[35/45] w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center overflow-hidden transition-all bg-muted/10 relative",
          slot.url ? "border-solid border-primary bg-white shadow-sm" : "border-muted",
          activeSlot === index && "ring-2 ring-primary"
        )}
      >
        <div 
          {...attributes} 
          {...listeners}
          className="absolute top-1 left-1 z-20 cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded-sm hover:bg-primary transition-colors"
        >
          <GripVertical className="h-3 w-3 text-white" />
        </div>

        <div 
          className="w-full h-full cursor-pointer"
          onClick={() => onSlotClick(index)}
        >
          {slot.url ? (
            <div className="relative w-full h-full group/image">
              <Image src={slot.url} alt={`Slot ${index+1}`} fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={(e) => { e.stopPropagation(); onRemove(index); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : <Plus className="h-4 w-4 text-muted-foreground" />}
        </div>
        <span className="absolute bottom-1 right-1 text-[8px] font-black bg-black/60 text-white px-1 rounded-sm">{index + 1}</span>
      </div>
      <Select 
        value={slot.sizeId} 
        onValueChange={(val) => onSizeChange(index, val)}
      >
        <SelectTrigger className="h-7 text-[9px] px-1 font-bold">
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {customSizes?.map(size => (
            <SelectItem key={size.id} value={size.id} className="text-[10px]">
              {size.name.split(' ')[0]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function GridMakerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  // Canvas & Grid State
  const [dpi, setDpi] = useState(DEFAULT_DPI);
  const [canvasDim, setCanvasDim] = useState({ width: 6, height: 4 }); 
  const [numCols, setNumCols] = useState(4);
  const [numRows, setNumRows] = useState(2);
  
  // High-Precision Spacing (Pixels)
  const [spacingWidthPx, setSpacingWidthPx] = useState(BLUEPRINT_GAP_W);
  const [spacingHeightPx, setSpacingHeightPx] = useState(BLUEPRINT_GAP_H);
  
  // Margin Controls (Pixels)
  const [marginLeft, setMarginLeft] = useState(BLUEPRINT_MARGIN_L);
  const [marginRight, setMarginRight] = useState(BLUEPRINT_MARGIN_R);
  const [marginTop, setMarginTop] = useState(BLUEPRINT_MARGIN_T);
  const [marginBottom, setMarginBottom] = useState(BLUEPRINT_MARGIN_B);

  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  
  const totalSlots = useMemo(() => numCols * numRows, [numCols, numRows]);
  const [slots, setSlots] = useState<SlotData[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [isAddSizeOpen, setIsAddSizeOpen] = useState(false);
  const [editingSizeId, setEditingSizeId] = useState<string | null>(null);
  const [newSize, setNewSize] = useState({
    name: '',
    description: '',
    width: 35,
    height: 45,
    unit: 'mm' as Unit,
    dpi: 300
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [targetSlotString, setTargetSlotString] = useState("");
  const [bulkFiles, setBulkFiles] = useState<any[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!user && !isUserLoading && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<any>(userProfileRef);

  useEffect(() => {
    if (user && db && !profile && !isUserLoading) {
      setDocumentNonBlocking(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email || 'anonymous@pixelpass.ai',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }, [user, db, profile, isUserLoading]);

  const customSizesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'custom_passport_sizes'), orderBy('order', 'asc'));
  }, [db, user]);

  const { data: customSizes, isLoading: isSizesLoading } = useCollection<CustomSize>(customSizesQuery);

  useEffect(() => {
    if (user && db && customSizes && customSizes.length === 0 && !isSizesLoading && !isUserLoading) {
      const defaultSizes = [
        {
          id: 'default-passport',
          name: 'Passport Photo',
          description: 'Standard International (35x45mm)',
          widthCm: 3.5,
          heightCm: 4.5,
          order: 0,
          dpi: 300
        },
        {
          id: 'blueprint-box',
          name: 'Blueprint Box',
          description: 'Custom 382x490px at 300DPI',
          widthCm: 3.23,
          heightCm: 4.15,
          order: 1,
          dpi: 300
        }
      ];

      defaultSizes.forEach(size => {
        setDocumentNonBlocking(
          doc(db, 'users', user.uid, 'custom_passport_sizes', size.id),
          {
            ...size,
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      });
    }
  }, [user, db, customSizes, isSizesLoading, isUserLoading]);

  useEffect(() => {
    if (customSizes && customSizes.length > 0 && !selectedSizeId) {
      setSelectedSizeId(customSizes[0].id);
    }
  }, [customSizes, selectedSizeId]);

  useEffect(() => {
    setSlots(prev => {
      if (prev.length === totalSlots) return prev;
      const nextSlots = [...prev];
      if (nextSlots.length < totalSlots) {
        for (let i = nextSlots.length; i < totalSlots; i++) {
          nextSlots.push({
            id: `slot-${Math.random().toString(36).substr(2, 9)}`,
            url: null,
            sizeId: selectedSizeId || (customSizes?.[0]?.id || '')
          });
        }
      } else if (nextSlots.length > totalSlots) {
        return nextSlots.slice(0, totalSlots);
      }
      return nextSlots;
    });
  }, [totalSlots, selectedSizeId, customSizes]);

  const cmToPx = useMemo(() => dpi / 2.54, [dpi]);
  
  const getSizeFromId = useCallback((sizeId: string) => {
    const size = customSizes?.find(s => s.id === sizeId);
    if (size) return { widthCm: size.widthCm, heightCm: size.heightCm };
    return { widthCm: 3.5, heightCm: 4.5 };
  }, [customSizes]);

  const canvasWidthPx = useMemo(() => {
    let totalW = marginLeft + marginRight;
    const colWidths = Array(numCols).fill(0);
    slots.slice(0, numCols).forEach((slot, i) => {
      const size = getSizeFromId(slot.sizeId);
      colWidths[i] = Math.round(size.widthCm * cmToPx);
    });
    totalW += colWidths.reduce((a, b) => a + b, 0);
    totalW += (numCols - 1) * spacingWidthPx;
    return totalW;
  }, [numCols, slots, getSizeFromId, cmToPx, marginLeft, marginRight, spacingWidthPx]);

  const canvasHeightPx = useMemo(() => {
    let totalH = marginTop + marginBottom;
    const rowHeights = Array(numRows).fill(0);
    for (let r = 0; r < numRows; r++) {
      const slotIndex = r * numCols;
      if (slots[slotIndex]) {
        const size = getSizeFromId(slots[slotIndex].sizeId);
        rowHeights[r] = Math.round(size.heightCm * cmToPx);
      }
    }
    totalH += rowHeights.reduce((a, b) => a + b, 0);
    totalH += (numRows - 1) * spacingHeightPx;
    return totalH;
  }, [numRows, numCols, slots, getSizeFromId, cmToPx, marginTop, marginBottom, spacingHeightPx]);

  const applyBlueprint = () => {
    setDpi(300);
    setNumCols(4);
    setNumRows(2);
    setSpacingWidthPx(BLUEPRINT_GAP_W);
    setSpacingHeightPx(BLUEPRINT_GAP_H);
    setMarginLeft(BLUEPRINT_MARGIN_L);
    setMarginRight(BLUEPRINT_MARGIN_R);
    setMarginTop(BLUEPRINT_MARGIN_T);
    setMarginBottom(BLUEPRINT_MARGIN_B);
    
    const blueprintSize = customSizes?.find(s => s.id === 'blueprint-box');
    if (blueprintSize) {
      setSelectedSizeId(blueprintSize.id);
      setSlots(prev => prev.map(s => ({ ...s, sizeId: blueprintSize.id })));
    }
    
    toast({
      title: "Blueprint Applied",
      description: "Canvas set to 1800x1202 pixels (6x4 in at 300 DPI).",
    });
  };

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
          setSlots(prev => {
            const newSlots = [...prev];
            newSlots[activeSlot] = { ...newSlots[activeSlot], url: newData };
            return newSlots;
          });
          toast({ title: "Photo Added", description: "HD Original Quality maintained." });
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
    if (bulkFiles.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please select at least one photo." });
      return;
    }

    let targetIndices: number[] = [];
    if (!targetSlotString.trim()) {
      targetIndices = Array.from({ length: Math.min(totalSlots, bulkFiles.length) }, (_, i) => i);
    } else {
      const parts = targetSlotString.split(',');
      parts.forEach(part => {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const start = parseInt(range[0]);
          const end = parseInt(range[1]);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) targetIndices.push(i - 1);
          }
        } else {
          const num = parseInt(part.trim());
          if (!isNaN(num)) targetIndices.push(num - 1);
        }
      });
      targetIndices = Array.from(new Set(targetIndices)).filter(n => n >= 0 && n < totalSlots);
    }

    if (targetIndices.length === 0) {
      toast({ variant: "destructive", title: "Invalid Range", description: "Please provide valid slot numbers." });
      return;
    }

    const loadedFiles = await Promise.all(bulkFiles.map(file => {
      return new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }));

    setSlots(prev => {
      const newSlots = [...prev];
      targetIndices.forEach((targetIndex, idx) => {
        if (targetIndex >= 0 && targetIndex < newSlots.length) {
          newSlots[targetIndex] = { ...newSlots[targetIndex], url: loadedFiles[idx % loadedFiles.length] };
        }
      });
      return newSlots;
    });

    setIsDistributionOpen(false);
    setTargetSlotString("");
    setBulkFiles([]);
    toast({ title: "Bulk Upload Complete" });
  };

  const handleRemove = (index: number) => {
    setSlots(prev => {
      const newSlots = [...prev];
      newSlots[index] = { ...newSlots[index], url: null };
      return newSlots;
    });
    toast({ title: "Photo Removed" });
  };

  const handleSizeChange = (index: number, sizeId: string) => {
    setSlots(prev => {
      const newSlots = [...prev];
      newSlots[index] = { ...newSlots[index], sizeId };
      return newSlots;
    });
  };

  const handleGlobalSizeChange = (sizeId: string) => {
    setSelectedSizeId(sizeId);
    setSlots(prev => prev.map(s => ({ ...s, sizeId })));
    toast({ title: "Global Size Applied" });
  };

  const resetGrid = () => {
    setSlots(prev => prev.map(s => ({ ...s, url: null })));
    toast({ title: "Grid Cleared", description: "All uploaded photos removed." });
  };

  const resetAllSettings = () => {
    setCanvasDim({ width: 6, height: 4 });
    setNumCols(4);
    setNumRows(2);
    setDpi(DEFAULT_DPI);
    setSpacingWidthPx(BLUEPRINT_GAP_W);
    setSpacingHeightPx(BLUEPRINT_GAP_H);
    setMarginLeft(BLUEPRINT_MARGIN_L);
    setMarginRight(BLUEPRINT_MARGIN_R);
    setMarginTop(BLUEPRINT_MARGIN_T);
    setMarginBottom(BLUEPRINT_MARGIN_B);
    if (customSizes && customSizes.length > 0) {
      setSelectedSizeId(customSizes[0].id);
      setSlots(prev => prev.map(s => ({ ...s, sizeId: customSizes[0].id })));
    }
    toast({ title: "Settings Reset", description: "All parameters returned to high-precision defaults." });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setSlots((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      toast({ title: "Layout Updated", description: "Photo moved to new position." });
    }
  };

  const convertToCm = (val: number, fromUnit: Unit, targetDpi: number): number => {
    if (fromUnit === 'cm') return val;
    if (fromUnit === 'mm') return val / 10;
    if (fromUnit === 'in') return val * 2.54;
    if (fromUnit === 'px') return (val / targetDpi) * 2.54;
    return val;
  };

  const convertFromCm = (cm: number, toUnit: Unit, targetDpi: number): number => {
    if (toUnit === 'cm') return cm;
    if (toUnit === 'mm') return cm * 10;
    if (toUnit === 'in') return cm / 2.54;
    if (toUnit === 'px') return (cm / 2.54) * targetDpi;
    return cm;
  };

  const handleUnitChange = (nextUnit: Unit) => {
    const currentWidthInCm = convertToCm(newSize.width, newSize.unit, newSize.dpi);
    const currentHeightInCm = convertToCm(newSize.height, newSize.unit, newSize.dpi);
    setNewSize(prev => ({
      ...prev,
      unit: nextUnit,
      width: nextUnit === 'mm' || nextUnit === 'px' ? Math.round(convertFromCm(currentWidthInCm, nextUnit, prev.dpi)) : Number(convertFromCm(currentWidthInCm, nextUnit, prev.dpi).toFixed(2)),
      height: nextUnit === 'mm' || nextUnit === 'px' ? Math.round(convertFromCm(currentHeightInCm, nextUnit, prev.dpi)) : Number(convertFromCm(currentHeightInCm, nextUnit, prev.dpi).toFixed(2))
    }));
  };

  const handleSaveCustomSize = () => {
    if (!user || !db) {
      toast({ variant: "destructive", title: "Wait a moment", description: "Your session is still connecting to our servers." });
      return;
    }
    
    if (!newSize.name || !newSize.width || !newSize.height || newSize.width <= 0 || newSize.height <= 0) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Please provide a valid name and positive dimensions." });
      return;
    }

    const widthInCm = convertToCm(newSize.width, newSize.unit, newSize.dpi);
    const heightInCm = convertToCm(newSize.height, newSize.unit, newSize.dpi);

    const sizeId = editingSizeId || doc(collection(db, 'users', user.uid, 'custom_passport_sizes')).id;
    const existingSize = customSizes?.find(s => s.id === editingSizeId);
    
    const sizeData: CustomSize = {
      id: sizeId,
      userId: user.uid,
      name: newSize.name,
      description: newSize.description || '',
      widthCm: Number(widthInCm.toFixed(2)),
      heightCm: Number(heightInCm.toFixed(2)),
      dpi: newSize.dpi,
      order: existingSize ? existingSize.order : (customSizes?.length || 0),
      createdAt: existingSize ? existingSize.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, 'users', user.uid, 'custom_passport_sizes', sizeId), sizeData, { merge: true });
    
    setIsAddSizeOpen(false);
    setEditingSizeId(null);
    setNewSize({ name: '', description: '', width: 35, height: 45, unit: 'mm', dpi: 300 });
    toast({ title: editingSizeId ? "Size Updated" : "Size Saved Permanently", description: "Resolution profile secured in cloud." });
  };

  const handleEditSize = (size: CustomSize) => {
    setEditingSizeId(size.id);
    setNewSize({
      name: size.name,
      description: size.description,
      width: Math.round(size.widthCm * 10),
      height: Math.round(size.heightCm * 10),
      unit: 'mm',
      dpi: size.dpi || 300
    });
    setIsAddSizeOpen(true);
  };

  const handleDeleteSize = (sizeId: string) => {
    if (!user || !db) return;
    deleteDocumentNonBlocking(doc(db, 'users', user.uid, 'custom_passport_sizes', sizeId));
    if (selectedSizeId === sizeId) {
      setSelectedSizeId('');
    }
    toast({
      title: "Size Deleted",
      description: "The resolution definition has been removed.",
    });
  };

  const drawCanvas = useCallback(async () => {
    if (typeof window === 'undefined' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvasWidthPx, canvasHeightPx);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

    const images = await Promise.all(slots.map(slot => {
      if (!slot.url) return Promise.resolve(null);
      return new Promise<HTMLImageElement | null>(resolve => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = slot.url;
      });
    }));

    const colWidths = Array(numCols).fill(0);
    const rowHeights = Array(numRows).fill(0);

    slots.forEach((slot, i) => {
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const size = getSizeFromId(slot.sizeId);
      const wPx = Math.round(size.widthCm * cmToPx);
      const hPx = Math.round(size.heightCm * cmToPx);
      if (wPx > colWidths[col]) colWidths[col] = wPx;
      if (hPx > rowHeights[row]) rowHeights[row] = hPx;
    });

    images.forEach((img, i) => {
      const col = i % numCols;
      const row = Math.floor(i / numCols);
      const slot = slots[i];
      const size = getSizeFromId(slot.sizeId);
      const slotWidth = Math.round(size.widthCm * cmToPx);
      const slotHeight = Math.round(size.heightCm * cmToPx);

      let x = marginLeft;
      for (let c = 0; c < col; c++) x += colWidths[c] + spacingWidthPx;

      let y = marginTop;
      for (let r = 0; r < row; r++) y += rowHeights[r] + spacingHeightPx;

      if (x + slotWidth > canvasWidthPx || y + slotHeight > canvasHeightPx) return;

      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, slotWidth, slotHeight);
        ctx.clip();
        const imgAspect = img.width / img.height;
        const slotAspect = slotWidth / slotHeight;
        let dW, dH;
        if (imgAspect > slotAspect) { dH = slotHeight; dW = dH * imgAspect; } 
        else { dW = slotWidth; dH = dW / imgAspect; }
        ctx.drawImage(img, x + (slotWidth - dW) / 2, y + (slotHeight - dH) / 2, dW, dH);
        ctx.restore();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1; 
        ctx.strokeRect(x, y, slotWidth, slotHeight);
      }
    });
  }, [slots, canvasWidthPx, canvasHeightPx, numCols, numRows, getSizeFromId, spacingWidthPx, spacingHeightPx, cmToPx, marginLeft, marginTop]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const downloadJPG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-hd.jpg`;
    link.href = canvasRef.current.toDataURL("image/jpeg", 1.0);
    link.click();
  };

  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `pixelpass-hd.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const downloadPDF = async () => {
    if (!canvasRef.current) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: canvasWidthPx > canvasHeightPx ? "landscape" : "portrait",
      unit: "in", format: [canvasWidthPx / dpi, canvasHeightPx / dpi]
    });
    pdf.addImage(canvasRef.current.toDataURL("image/png"), "PNG", 0, 0, canvasWidthPx / dpi, canvasHeightPx / dpi);
    pdf.save(`pixelpass-hd.pdf`);
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
              <Grid3x3 className="h-8 w-8" /> HD Drag & Place Grid
            </h1>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
              {dpi} DPI Rendering • {canvasWidthPx} x {canvasHeightPx} Pixels
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={applyBlueprint} variant="outline" className="rounded-full border-primary text-primary hover:bg-primary/10">
              <Settings2 className="mr-2 h-4 w-4" /> Standard 4x6 Blueprint
            </Button>
            
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <Ruler className="mr-2 h-4 w-4" /> Paper Format
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Physical Print Dimensions</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Width (in)</Label>
                    <Input type="number" value={canvasDim.width} onChange={(e) => setCanvasDim({...canvasDim, width: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (in)</Label>
                    <Input type="number" value={canvasDim.height} onChange={(e) => setCanvasDim({...canvasDim, height: Number(e.target.value)})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsSettingsOpen(false)} className="w-full">Save Format</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDistributionOpen} onOpenChange={setIsDistributionOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full font-bold shadow-lg">
                  <Layers className="mr-2 h-4 w-4" /> Targeted Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Pattern Distribution</DialogTitle>
                  <DialogDescription>Assign HD photos to specific grid positions.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Target Slots:</Label>
                    </div>
                    <Input placeholder="e.g., 1, 3-5, 8" value={targetSlotString} onChange={(e) => setTargetSlotString(e.target.value)} />
                    
                    <div className="flex flex-col gap-2 mt-2">
                      <Label className="text-[9px] font-bold uppercase text-muted-foreground">Quick Presets:</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] rounded-full px-3"
                          onClick={() => setTargetSlotString("1, 2, 5, 6")}
                        >
                          1, 2, 5, 6
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] rounded-full px-3"
                          onClick={() => setTargetSlotString("1, 2, 3, 5, 6, 7")}
                        >
                          1, 2, 3, 5, 6, 7
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] rounded-full px-3"
                          onClick={() => setTargetSlotString("1-" + totalSlots)}
                        >
                          Fill All Slots
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div 
                    className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => bulkInputRef.current?.click()}
                  >
                    <Plus className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs font-medium">
                      {bulkFiles.length > 0 ? `${bulkFiles.length} photos ready` : "Select HD Originals"}
                    </p>
                    <input type="file" multiple ref={bulkInputRef} className="hidden" onChange={handleBulkFileChange} accept="image/*" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleProcessBulk} className="w-full">Distribute Photos</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-xl border-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary" /> Configuration
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={resetAllSettings}
                  title="Reset All Configuration"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Columns</Label>
                    <Input type="number" value={numCols} onChange={(e) => setNumCols(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Rows</Label>
                    <Input type="number" value={numRows} onChange={(e) => setNumRows(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Global Resolution (DPI)</Label>
                  <Input 
                    type="number" 
                    value={dpi} 
                    onChange={(e) => setDpi(Math.max(72, parseInt(e.target.value) || 300))} 
                    className="h-8 text-xs"
                  />
                  <p className="text-[9px] text-muted-foreground italic">Affects final exported image resolution.</p>
                </div>

                <div className="space-y-6 pt-4 border-t">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Margins (px)</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground uppercase">Top</Label>
                      <Input type="number" value={marginTop} onChange={(e) => setMarginTop(parseInt(e.target.value) || 0)} className="h-7 text-[10px]" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground uppercase">Bottom</Label>
                      <Input type="number" value={marginBottom} onChange={(e) => setMarginBottom(parseInt(e.target.value) || 0)} className="h-7 text-[10px]" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground uppercase">Left</Label>
                      <Input type="number" value={marginLeft} onChange={(e) => setMarginLeft(parseInt(e.target.value) || 0)} className="h-7 text-[10px]" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground uppercase">Right</Label>
                      <Input type="number" value={marginRight} onChange={(e) => setMarginRight(parseInt(e.target.value) || 0)} className="h-7 text-[10px]" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-4 border-t">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Photo Gaps (px)</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-bold uppercase text-muted-foreground">Gap Width</Label>
                        <span className="text-[9px] font-bold text-primary">{spacingWidthPx}px</span>
                      </div>
                      <Slider 
                        value={[spacingWidthPx]} 
                        min={0} 
                        max={200} 
                        step={1} 
                        onValueChange={(val) => setSpacingWidthPx(val[0])}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] font-bold uppercase text-muted-foreground">Gap Height</Label>
                        <span className="text-[9px] font-bold text-primary">{spacingHeightPx}px</span>
                      </div>
                      <Slider 
                        value={[spacingHeightPx]} 
                        min={0} 
                        max={200} 
                        step={1} 
                        onValueChange={(val) => setSpacingHeightPx(val[0])}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Image Size</Label>
                    <Dialog open={isAddSizeOpen} onOpenChange={(open) => {
                      setIsAddSizeOpen(open);
                      if (!open) {
                        setEditingSizeId(null);
                        setNewSize({ name: '', description: '', width: 35, height: 45, unit: 'mm', dpi: 300 });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-primary font-bold">
                          <Plus className="h-4 w-4 mr-1" /> New Preset
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{editingSizeId ? 'Edit' : 'Add'} Image Size Presets</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input placeholder="e.g., My Passport" value={newSize.name} onChange={(e) => setNewSize({...newSize, name: e.target.value})} />
                          </div>
                          <div className="space-y-3">
                            <Label>Unit & Dimensions</Label>
                            <Tabs value={newSize.unit} onValueChange={(v) => handleUnitChange(v as Unit)}>
                              <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="mm">MM</TabsTrigger>
                                <TabsTrigger value="cm">CM</TabsTrigger>
                                <TabsTrigger value="in">IN</TabsTrigger>
                                <TabsTrigger value="px">PX</TabsTrigger>
                              </TabsList>
                            </Tabs>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Width ({newSize.unit})</Label>
                                <Input 
                                  type="number" 
                                  step={newSize.unit === 'px' || newSize.unit === 'mm' ? "1" : "0.01"}
                                  value={newSize.width} 
                                  onChange={(e) => setNewSize({...newSize, width: Number(e.target.value)})} 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Height ({newSize.unit})</Label>
                                <Input 
                                  type="number" 
                                  step={newSize.unit === 'px' || newSize.unit === 'mm' ? "1" : "0.01"}
                                  value={newSize.height} 
                                  onChange={(e) => setNewSize({...newSize, height: Number(e.target.value)})} 
                                />
                              </div>
                            </div>
                            <div className="space-y-2 pt-2">
                              <Label className="text-xs uppercase font-bold text-muted-foreground">Resolution (DPI)</Label>
                              <Input 
                                type="number" 
                                value={newSize.dpi} 
                                onChange={(e) => setNewSize({...newSize, dpi: Number(e.target.value)})} 
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddSizeOpen(false)}>Cancel</Button>
                          <Button onClick={handleSaveCustomSize}>Save Resolution</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                    {isSizesLoading ? (
                      <div className="text-center py-4">
                        <RefreshCw className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : customSizes?.map((size) => (
                      <div key={size.id} className="group flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{size.name}</p>
                          <p className="text-[10px] text-muted-foreground">{size.widthCm} x {size.heightCm} cm</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSize(size)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteSize(size.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Select value={selectedSizeId} onValueChange={handleGlobalSizeChange}>
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Global Preset Size..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customSizes?.map(size => (
                        <SelectItem key={size.id} value={size.id}>
                          {size.name} ({size.widthCm}x{size.heightCm} cm)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-6 border-t space-y-3">
                  <Button className="w-full h-12 font-bold bg-secondary hover:bg-secondary/90 text-white shadow-md" onClick={downloadPNG} disabled={!slots.some(s => s.url)}>
                    <Download className="mr-2 h-4 w-4" /> Export HD PNG
                  </Button>
                  <Button className="w-full h-12 font-bold shadow-md" onClick={downloadJPG} disabled={!slots.some(s => s.url)}>
                    <FileImage className="mr-2 h-4 w-4" /> Export HD JPG
                  </Button>
                  <Button variant="outline" className="w-full h-12 font-bold" onClick={downloadPDF} disabled={!slots.some(s => s.url)}>
                    <FileText className="mr-2 h-5 w-5" /> Export HD PDF
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-destructive hover:bg-destructive/10 font-bold" 
                    onClick={resetGrid}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset Grid
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-slate-100 border-none flex flex-col items-center justify-center p-8 min-h-[600px] rounded-3xl overflow-hidden shadow-inner">
              <div className="relative shadow-2xl bg-white rounded-sm overflow-hidden border-8 border-white/50">
                <div 
                  className="relative bg-white shadow-inner"
                  style={{ 
                    width: '600px', 
                    height: `${(600 / canvasWidthPx) * canvasHeightPx}px` 
                  }}
                >
                  <canvas ref={canvasRef} width={canvasWidthPx} height={canvasHeightPx} className="absolute inset-0 w-full h-full" />
                  {!slots.some(s => s.url) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
                      <Camera className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-40 text-center">
                        {canvasWidthPx} x {canvasHeightPx} pixels<br/>
                        {dpi} DPI HD Canvas
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="shadow-xl border-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4" /> Interactive Grid Layout
                </CardTitle>
                <CardDescription className="text-[10px] font-medium">
                  This interactive area mirrors your output structure. Drag to reorder photos on the HD canvas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={slots.map(s => s.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div 
                      className="grid gap-4"
                      style={{ 
                        gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                      }}
                    >
                      {slots.map((slot, i) => (
                        <SortableSlot 
                          key={slot.id}
                          index={i}
                          slot={slot}
                          activeSlot={activeSlot}
                          onSlotClick={handleSlotClick}
                          onRemove={handleRemove}
                          onSizeChange={handleSizeChange}
                          customSizes={customSizes}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          </div>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        <input type="file" multiple ref={bulkInputRef} className="hidden" onChange={handleBulkFileChange} accept="image/*" />
      </main>
    </div>
  );
}