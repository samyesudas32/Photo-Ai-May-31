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
  useMemoFirebase,
  setDocumentNonBlocking 
} from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { cn } from "@/lib/utils";

type CoatStyle = 'none' | 'suit' | 'blazer' | 'overcoat';
type Unit = 'cm' | 'in' | 'px';

const DPI = 300;

interface CustomSize {
  id: string;
  name: string;
  description: string;
  widthCm: number;
  heightCm: number;
  userId: string;
  createdAt: string;
}

const PRESET_BG_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Off-white', value: '#F5F5F5' },
  { name: 'Light Blue', value: '#ADD8E6' },
  { name: 'Light Grey', value: '#D3D3D3' },
];

export default function EditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState<CoatStyle>('none');
  const [selectedSizeId, setSelectedSizeId] = useState<string>('standard');
  const [selectedBgColor, setSelectedBgColor] = useState<string>('#FFFFFF');
  const [isAddSizeOpen, setIsAddSizeOpen] = useState(false);
  
  // Custom Size Form State
  const [newSize, setNewSize] = useState({
    name: '',
    description: '',
    width: 5.1,
    height: 5.1,
    unit: 'cm' as Unit
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();

  // Handle Anonymous Login
  useEffect(() => {
    if (!user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, auth]);

  // Fetch Custom Sizes
  const customSizesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'custom_passport_sizes');
  }, [db, user]);

  const { data: customSizes } = useCollection<CustomSize>(customSizesQuery);

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

  const convertToCm = (val: number, fromUnit: Unit): number => {
    if (fromUnit === 'cm') return val;
    if (fromUnit === 'in') return val * 2.54;
    if (fromUnit === 'px') return (val / DPI) * 2.54;
    return val;
  };

  const convertFromCm = (cm: number, toUnit: Unit): number => {
    if (toUnit === 'cm') return cm;
    if (toUnit === 'in') return cm / 2.54;
    if (toUnit === 'px') return (cm / 2.54) * DPI;
    return cm;
  };

  const handleUnitChange = (nextUnit: Unit) => {
    const currentWidthInCm = convertToCm(newSize.width, newSize.unit);
    const currentHeightInCm = convertToCm(newSize.height, newSize.unit);
    
    setNewSize(prev => ({
      ...prev,
      unit: nextUnit,
      width: Number(convertFromCm(currentWidthInCm, nextUnit).toFixed(2)),
      height: Number(convertFromCm(currentHeightInCm, nextUnit).toFixed(2))
    }));
  };

  const handleSaveCustomSize = () => {
    if (!user || !db) return;
    if (!newSize.name || !newSize.width || !newSize.height) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a name and dimensions.",
      });
      return;
    }

    const widthInCm = convertToCm(newSize.width, newSize.unit);
    const heightInCm = convertToCm(newSize.height, newSize.unit);

    const sizeId = doc(collection(db, 'users', user.uid, 'custom_passport_sizes')).id;
    const sizeData: CustomSize = {
      id: sizeId,
      userId: user.uid,
      name: newSize.name,
      description: newSize.description,
      widthCm: Number(widthInCm.toFixed(2)),
      heightCm: Number(heightInCm.toFixed(2)),
      createdAt: new Date().toISOString()
    };

    setDocumentNonBlocking(
      doc(db, 'users', user.uid, 'custom_passport_sizes', sizeId),
      sizeData,
      { merge: true }
    );

    setIsAddSizeOpen(false);
    setNewSize({ name: '', description: '', width: 5.1, height: 5.1, unit: 'cm' });
    toast({
      title: "Size Saved",
      description: "Your custom passport size has been saved.",
    });
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
    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: "There was an error transforming your photo. Please try another image.",
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
    setSelectedSizeId('standard');
    setSelectedBgColor('#FFFFFF');
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
          <h1 className="text-3xl font-bold tracking-tight">Passport Photo Editor</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <Card className="min-h-[500px] flex flex-col items-center justify-center border-dashed border-2 bg-white relative overflow-hidden group">
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
                    <div className="absolute top-4 left-4 z-10 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm backdrop-blur-sm">
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
                      <Image 
                        src={processedUrl} 
                        alt="Processed" 
                        fill 
                        className="object-contain p-2"
                      />
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-muted/30 rounded-xl border animate-pulse">
                      <div className="relative">
                        <Camera className="h-12 w-12 text-primary animate-bounce" />
                        <div className="absolute -top-1 -right-1">
                          <RefreshCw className="h-5 w-5 text-secondary animate-spin" />
                        </div>
                      </div>
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
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-white border-none shadow-xl sticky top-24">
              <CardHeader>
                <CardTitle>Processing Options</CardTitle>
                <CardDescription>Configure your passport photo parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Clothing Style */}
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

                {/* Background Color */}
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
                        onChange={(e) => setSelectedBgColor(e.target.value)}
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
                        onClick={() => setSelectedBgColor(color.value)}
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

                {/* Photo Size */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Photo Size</Label>
                    <Dialog open={isAddSizeOpen} onOpenChange={setIsAddSizeOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-primary">
                          <Plus className="h-4 w-4 mr-1" /> Custom Size
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Custom Passport Size</DialogTitle>
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
                              <TabsList className="grid w-full grid-cols-3">
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
                                  step={newSize.unit === 'px' ? "1" : "0.01"}
                                  value={newSize.width}
                                  onChange={(e) => setNewSize({...newSize, width: Number(e.target.value)})}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="height" className="text-xs text-muted-foreground uppercase">Height ({newSize.unit})</Label>
                                <Input 
                                  id="height" 
                                  type="number" 
                                  step={newSize.unit === 'px' ? "1" : "0.01"}
                                  value={newSize.height}
                                  onChange={(e) => setNewSize({...newSize, height: Number(e.target.value)})}
                                />
                              </div>
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

                  <RadioGroup 
                    value={selectedSizeId} 
                    onValueChange={setSelectedSizeId}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                      <RadioGroupItem value="standard" id="standard" />
                      <Label htmlFor="standard" className="flex-1 cursor-pointer">
                        <div className="font-semibold">Standard Passport</div>
                        <div className="text-[10px] text-muted-foreground italic">Official 2x2 inch (5.1 x 5.1 cm)</div>
                      </Label>
                    </div>

                    {customSizes?.map((size) => (
                      <div key={size.id} className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-accent cursor-pointer">
                        <RadioGroupItem value={size.id} id={size.id} />
                        <Label htmlFor={size.id} className="flex-1 cursor-pointer">
                          <div className="font-semibold">{size.name}</div>
                          <div className="text-[10px] text-muted-foreground italic">
                            {size.widthCm} x {size.heightCm} cm • {size.description}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="pt-6 border-t space-y-3">
                  {!processedUrl ? (
                    <Button 
                      className="w-full h-12 text-lg font-bold" 
                      onClick={handleProcess}
                      disabled={!previewUrl || isProcessing}
                    >
                      {isProcessing ? "Processing..." : "Generate Passport Photo"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button 
                        className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" 
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
