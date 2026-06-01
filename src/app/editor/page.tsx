"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { 
  Upload, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  ArrowLeft,
  Camera,
  Maximize2,
  Trash2,
  Shirt,
  User,
  Briefcase,
  Plus,
  Pencil,
  Ruler,
  GripVertical,
  Square,
  Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { transformPhoto } from "@/ai/flows/ai-photo-transformation-flow";
import Link from "next/link";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  useUser, 
  useFirestore, 
  useAuth, 
  useCollection, 
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking
} from "@/firebase";
import { collection, doc, query, orderBy } from "firebase/firestore";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { cn } from "@/lib/utils";

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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

type CoatStyle = 'none' | 'suit' | 'blazer' | 'overcoat';
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

const PRESET_BG_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Off-white', value: '#F5F5F5' },
  { name: 'Light Blue', value: '#ADD8E6' },
  { name: 'Light Grey', value: '#D3D3D3' },
];

function SortableSizeItem({ 
  size, 
  selectedSizeId, 
  isProcessing, 
  handleEditSize, 
  handleDeleteSize 
}: { 
  size: CustomSize; 
  selectedSizeId: string;
  isProcessing: boolean;
  handleEditSize: (size: CustomSize) => void;
  handleDeleteSize: (sizeId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: size.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <RadioGroupItem value={size.id} id={size.id} className="peer sr-only" />
      <div 
        className={cn(
          "flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer bg-card hover:border-primary/50",
          selectedSizeId === size.id ? "border-primary bg-primary/5 shadow-sm" : "border-muted"
        )}
      >
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary transition-colors p-1"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        
        <Label 
          htmlFor={size.id} 
          className="flex-1 cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{size.name}</span>
              {selectedSizeId === size.id && <CheckCircle2 className="h-3 w-3 text-primary" />}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {size.widthCm} x {size.heightCm} cm
            </div>
            {size.description && (
              <div className="text-[9px] text-muted-foreground italic mt-1 line-clamp-1">{size.description}</div>
            )}
          </div>
        </Label>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              handleEditSize(size);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSize(size.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<CoatStyle>('none');
  const [selectedSizeId, setSelectedSizeId] = useState<string>('');
  const [selectedBgColor, setSelectedBgColor] = useState("#FFFFFF");
  
  // Photo Styling states
  const [hasStroke, setHasStroke] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        lastSelectedBgColor: '#FFFFFF',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  }, [user, db, profile, isUserLoading]);

  useEffect(() => {
    if (profile?.lastSelectedBgColor) {
      setSelectedBgColor(profile.lastSelectedBgColor);
    }
  }, [profile?.lastSelectedBgColor]);

  const customSizesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'users', user.uid, 'custom_passport_sizes'), orderBy('order', 'asc'));
  }, [db, user]);

  const { data: customSizes, isLoading: isSizesLoading } = useCollection<CustomSize>(customSizesQuery);

  // Seed default sizes
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
          id: 'default-stamp',
          name: 'Stamp Size',
          description: 'Small format for documents (20x25mm)',
          widthCm: 2.0,
          heightCm: 2.5,
          order: 1,
          dpi: 300
        },
        {
          id: 'default-pan',
          name: 'PAN Card Size',
          description: 'Official Indian PAN Card (25x35mm)',
          widthCm: 2.5,
          heightCm: 3.5,
          order: 2,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type.startsWith("image/")) {
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onload = () => {
          setPreviewUrl(reader.result as string);
          setProcessedUrl(null);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please upload an image file (PNG, JPG, etc).",
        });
      }
    }
  };

  const convertToCm = (val: number, fromUnit: Unit, dpi: number = 300): number => {
    if (fromUnit === 'cm') return val;
    if (fromUnit === 'mm') return val / 10;
    if (fromUnit === 'in') return val * 2.54;
    if (fromUnit === 'px') return (val / dpi) * 2.54;
    return val;
  };

  const convertFromCm = (cm: number, toUnit: Unit, dpi: number = 300): number => {
    if (toUnit === 'cm') return cm;
    if (toUnit === 'mm') return cm * 10;
    if (toUnit === 'in') return cm / 2.54;
    if (toUnit === 'px') return (cm / 2.54) * dpi;
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
    if (!newSize.name || !newSize.width || !newSize.height) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a name and dimensions.",
      });
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

    setDocumentNonBlocking(
      doc(db, 'users', user.uid, 'custom_passport_sizes', sizeId),
      sizeData,
      { merge: true }
    );

    setIsAddSizeOpen(false);
    setEditingSizeId(null);
    setNewSize({ name: '', description: '', width: 35, height: 45, unit: 'mm', dpi: 300 });
    toast({
      title: editingSizeId ? "Size Updated" : "Size Saved Permanently",
      description: `Your resolution preset has been secured in the cloud.`,
    });
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
      description: "The size definition has been removed.",
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && customSizes) {
      const oldIndex = customSizes.findIndex((s) => s.id === active.id);
      const newIndex = customSizes.findIndex((s) => s.id === over?.id);

      const newOrderArr = arrayMove(customSizes, oldIndex, newIndex);
      
      newOrderArr.forEach((size, index) => {
        if (size.order !== index && user && db) {
          updateDocumentNonBlocking(
            doc(db, 'users', user.uid, 'custom_passport_sizes', size.id),
            { order: index, updatedAt: new Date().toISOString() }
          );
        }
      });
    }
  };

  const handleBgColorChange = (color: string) => {
    setSelectedBgColor(color);
    if (user && db) {
      setDocumentNonBlocking(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email || 'anonymous@pixelpass.ai',
        lastSelectedBgColor: color,
        updatedAt: new Date().toISOString(),
        createdAt: profile?.createdAt || new Date().toISOString()
      }, { merge: true });
    }
  };

  const handleProcess = async () => {
    if (!previewUrl) return;

    setIsProcessing(true);
    setProgress(10);
    setProcessedUrl(null);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 5 : prev));
    }, 1000);

    try {
      const result = await transformPhoto({ 
        photoDataUri: previewUrl,
        coatStyle: selectedStyle !== 'none' ? selectedStyle : undefined,
        backgroundColor: selectedBgColor
      });
      clearInterval(progressInterval);
      setProgress(100);
      setProcessedUrl(result.processedPhotoDataUri);
      toast({
        title: "Success!",
        description: "Your passport photo has been professionally processed.",
      });
    } catch (error: any) {
      clearInterval(progressInterval);
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: error.message || "There was an error transforming your photo.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedUrl) return;
    const link = document.createElement("a");
    link.href = processedUrl;
    link.download = `pixelpass-passport-${selectedStyle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetEditor = () => {
    setFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setProgress(0);
    setSelectedStyle('none');
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
          <h1 className="text-3xl font-bold tracking-tight text-primary">Passport Photo Editor</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <Card className="min-h-[500px] flex flex-col items-center justify-center border-dashed border-2 bg-white relative overflow-hidden">
              {!previewUrl ? (
                <div 
                  className="flex flex-col items-center justify-center p-12 text-center cursor-pointer w-full h-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Upload your portrait</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Ensure the subject is facing forward with a neutral expression and eyes open.
                  </p>
                  <Button className="rounded-full px-8">Select Image</Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col md:flex-row gap-4 p-4">
                  <div className="flex-1 relative bg-muted rounded-xl overflow-hidden border">
                    <div className="absolute top-4 left-4 z-10 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
                      ORIGINAL
                    </div>
                    <Image 
                      src={previewUrl} 
                      alt="Original" 
                      fill 
                      className="object-contain"
                    />
                  </div>
                  
                  {processedUrl && (
                    <div className="flex-1 relative bg-white rounded-xl overflow-hidden border shadow-inner">
                      <div className="absolute top-4 left-4 z-10 bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-sm">
                        PROCESSED
                      </div>
                      <div 
                        className="relative w-full h-full"
                        style={hasStroke ? { 
                          border: `${strokeWidth}px solid ${strokeColor}`,
                          boxSizing: 'border-box'
                        } : {}}
                      >
                        <Image 
                          src={processedUrl} 
                          alt="Processed" 
                          fill 
                          className="object-contain p-2"
                        />
                      </div>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-muted/30 rounded-xl border animate-pulse">
                      <Camera className="h-12 w-12 text-primary animate-bounce" />
                      <div className="text-center">
                        <p className="font-bold text-lg">Enhancing Image...</p>
                        <p className="text-xs text-muted-foreground">Applying selected standards</p>
                      </div>
                      <div className="w-48">
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white/50">
                <CardContent className="p-4 flex gap-4 items-start">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Official Standards</h4>
                    <p className="text-xs text-muted-foreground">AI aligns eyes and head according to official biometric rules.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/50">
                <CardContent className="p-4 flex gap-4 items-start">
                  <Maximize2 className="h-5 w-5 text-secondary mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Quality Guaranteed</h4>
                    <p className="text-xs text-muted-foreground">Low quality uploads are enhanced and upscaled for clear printing.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/50 border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Photo Styling
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <Button
                      variant={hasStroke ? "default" : "outline"}
                      className="w-full justify-start gap-2"
                      onClick={() => setHasStroke(!hasStroke)}
                      disabled={isProcessing}
                    >
                      <Square className={cn(
                        "h-4 w-4",
                        hasStroke ? "fill-current" : ""
                      )} />
                      {hasStroke ? "Stroke Applied" : "Add Photo Stroke"}
                    </Button>

                    {hasStroke && (
                      <div className="space-y-4 p-4 rounded-lg bg-white border animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Stroke Color</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-muted-foreground">{strokeColor}</span>
                              <Input 
                                type="color" 
                                value={strokeColor} 
                                onChange={(e) => setStrokeColor(e.target.value)}
                                className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer rounded-full overflow-hidden"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Stroke Width</Label>
                            <span className="text-[10px] font-bold text-primary">{strokeWidth}px</span>
                          </div>
                          <Slider 
                            value={[strokeWidth]} 
                            min={1} 
                            max={10} 
                            step={1} 
                            onValueChange={(val) => setStrokeWidth(val[0])}
                            className="py-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground italic">
                      Customizing the stroke allows you to clearly define the edges of your photo, which is helpful for manual cutting after printing.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border-none shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle>Processing Options</CardTitle>
                <CardDescription>Configure your passport photo parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Clothing Style</Label>
                  <RadioGroup 
                    value={selectedStyle} 
                    onValueChange={(val) => setSelectedStyle(val as CoatStyle)}
                    className="grid grid-cols-2 gap-3"
                    disabled={isProcessing}
                  >
                    {[
                      { id: 'none', label: 'Original', icon: User },
                      { id: 'suit', label: 'Classic Suit', icon: Briefcase },
                      { id: 'blazer', label: 'Tailored Blazer', icon: Shirt },
                      { id: 'overcoat', label: 'Overcoat', icon: Shirt },
                    ].map((style) => (
                      <div key={style.id} className="relative">
                        <RadioGroupItem
                          value={style.id}
                          id={style.id}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={style.id}
                          className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                        >
                          <style.icon className="mb-2 h-5 w-5" />
                          <span className="text-[10px] font-bold">{style.label}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Background Color</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border shadow-sm"
                        style={{ backgroundColor: selectedBgColor }}
                      />
                      <Input 
                        type="color" 
                        value={selectedBgColor} 
                        onChange={(e) => handleBgColorChange(e.target.value)}
                        className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer"
                        title="Choose custom color"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_BG_COLORS.map((color) => (
                      <Button
                        key={color.value}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 px-3 text-xs font-medium rounded-full",
                          selectedBgColor === color.value && "border-primary bg-primary/10 text-primary"
                        )}
                        onClick={() => handleBgColorChange(color.value)}
                        disabled={isProcessing}
                      >
                        <div 
                          className="w-3 h-3 rounded-full mr-1.5 border" 
                          style={{ backgroundColor: color.value }}
                        />
                        {color.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Image Size</Label>
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
                          <DialogDescription>Define specific dimensions for your photo requirements.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="size-name">Name</Label>
                            <Input 
                              id="size-name" 
                              placeholder="e.g., Visa Application" 
                              value={newSize.name}
                              onChange={(e) => setNewSize({...newSize, name: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="size-desc">Description</Label>
                            <Textarea 
                              id="size-desc" 
                              placeholder="Describe the purpose of this size..." 
                              value={newSize.description}
                              onChange={(e) => setNewSize({...newSize, description: e.target.value})}
                            />
                          </div>
                          <div className="space-y-3">
                            <Label>Dimensions</Label>
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
                                <Label htmlFor="width" className="text-xs text-muted-foreground uppercase">Width ({newSize.unit})</Label>
                                <Input 
                                  id="width" 
                                  type="number" 
                                  step={newSize.unit === 'px' || newSize.unit === 'mm' ? "1" : "0.01"}
                                  value={newSize.width}
                                  onChange={(e) => setNewSize({...newSize, width: Number(e.target.value)})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="height" className="text-xs text-muted-foreground uppercase">Height ({newSize.unit})</Label>
                                <Input 
                                  id="height" 
                                  type="number" 
                                  step={newSize.unit === 'px' || newSize.unit === 'mm' ? "1" : "0.01"}
                                  value={newSize.height}
                                  onChange={(e) => setNewSize({...newSize, height: Number(e.target.value)})}
                                />
                              </div>
                            </div>
                            <div className="space-y-2 pt-2">
                              <Label htmlFor="dpi" className="text-xs text-muted-foreground uppercase">Resolution (DPI)</Label>
                              <Input 
                                id="dpi" 
                                type="number" 
                                value={newSize.dpi}
                                onChange={(e) => setNewSize({...newSize, dpi: Number(e.target.value)})}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddSizeOpen(false)}>Cancel</Button>
                          <Button onClick={handleSaveCustomSize}>Save Size</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    <RadioGroup 
                      value={selectedSizeId} 
                      onValueChange={setSelectedSizeId}
                      className="space-y-2"
                    >
                      {isSizesLoading ? (
                        <div className="text-center py-4">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                        </div>
                      ) : customSizes?.length === 0 ? (
                        <div className="text-center py-4 px-2 border-2 border-dashed rounded-lg bg-muted/20">
                          <Ruler className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-muted-foreground font-medium">No sizes defined.</p>
                        </div>
                      ) : null}

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                      >
                        <SortableContext 
                          items={customSizes?.map(s => s.id) || []}
                          strategy={verticalListSortingStrategy}
                        >
                          {customSizes?.map((size) => (
                            <SortableSizeItem 
                              key={size.id} 
                              size={size} 
                              selectedSizeId={selectedSizeId} 
                              isProcessing={isProcessing}
                              handleEditSize={handleEditSize}
                              handleDeleteSize={handleDeleteSize}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </RadioGroup>
                  </div>
                </div>

                <div className="pt-6 border-t space-y-3">
                  {!processedUrl ? (
                    <Button 
                      className="w-full h-12 text-lg font-bold shadow-lg" 
                      onClick={handleProcess}
                      disabled={!previewUrl || isProcessing || isUserLoading}
                    >
                      {isProcessing ? "Processing..." : "Generate Passport Photo"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button 
                        className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg" 
                        onClick={handleDownload}
                      >
                        <Download className="mr-2 h-5 w-5" /> Download (Print Ready)
                      </Button>
                      <Button 
                        variant="outline"
                        className="w-full h-12 text-lg font-bold" 
                        onClick={handleProcess}
                        disabled={isProcessing}
                      >
                        <RefreshCw className={`mr-2 h-5 w-5 ${isProcessing ? 'animate-spin' : ''}`} /> Regenerate
                      </Button>
                    </div>
                  )}
                  
                  {previewUrl && !isProcessing && (
                    <Button 
                      variant="ghost" 
                      className="w-full text-destructive hover:bg-destructive/10" 
                      onClick={resetEditor}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Reset and Upload New
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
