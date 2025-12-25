
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider'; // Ensure this exists, or use standard input
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, ZoomIn, RotateCw, Image as ImageIcon, X, Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ImageCropperProps {
    onCropComplete: (blob: Blob) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isAuthorized?: boolean;
    onAuthorize?: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    onCropComplete,
    open,
    onOpenChange,
    isAuthorized = true,
    onAuthorize
}) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result?.toString() || null);
                setZoom(1);
                setRotation(0);
            });
            reader.readAsDataURL(file);
        }
    };

    // Draw image on canvas
    useEffect(() => {
        if (!imageSrc || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const image = new Image();
        image.src = imageSrc;
        image.onload = () => {
            imageRef.current = image;
            drawImage();
        };
    }, [imageSrc]);

    useEffect(() => {
        if (imageRef.current) drawImage();
    }, [zoom, rotation]);

    const drawImage = () => {
        if (!canvasRef.current || !imageRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const CANVAS_SIZE = 300;
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background style (circle mask or just bg)
        ctx.fillStyle = '#1e293b'; // slate-800
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();

        // Circular Mask specific for profile
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, 2 * Math.PI);
        ctx.clip();

        // Transformations
        ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);
        ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);

        // Draw centered image
        // We want to fit the image ensuring it covers the area
        const imgAspect = imageRef.current.width / imageRef.current.height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > 1) {
            drawHeight = CANVAS_SIZE;
            drawWidth = CANVAS_SIZE * imgAspect;
            offsetX = -(drawWidth - CANVAS_SIZE) / 2;
            offsetY = 0;
        } else {
            drawWidth = CANVAS_SIZE;
            drawHeight = CANVAS_SIZE / imgAspect;
            offsetX = 0;
            offsetY = -(drawHeight - CANVAS_SIZE) / 2;
        }

        ctx.drawImage(imageRef.current, offsetX, offsetY, drawWidth, drawHeight);

        ctx.restore();
    };

    const handleSave = () => {
        if (!canvasRef.current) return;
        canvasRef.current.toBlob((blob) => {
            if (blob) {
                onCropComplete(blob);
                onOpenChange(false);
                setImageSrc(null); // Reset
            }
        }, 'image/png');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Profile Picture</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-4">
                    {!imageSrc ? (
                        <div
                            className="w-64 h-64 border-2 border-dashed border-slate-700 rounded-full flex flex-col items-center justify-center cursor-pointer hover:border-slate-500 hover:bg-slate-800/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-10 w-10 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-400">Click to upload image</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <canvas
                                ref={canvasRef}
                                className="w-64 h-64 rounded-full border-2 border-emerald-500 shadow-xl"
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                                onClick={() => setImageSrc(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onFileChange}
                        accept="image/*"
                        className="hidden"
                    />

                    {imageSrc && (
                        <div className="w-full space-y-4 px-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><ZoomIn className="h-3 w-3" /> Zoom</span>
                                    <span>{Math.round(zoom * 100)}%</span>
                                </div>
                                <Slider
                                    value={[zoom]}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    onValueChange={(v) => setZoom(v[0])}
                                    className="[&_.range-thumb]:bg-emerald-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><RotateCw className="h-3 w-3" /> Rotate</span>
                                    <span>{rotation}°</span>
                                </div>
                                <Slider
                                    value={[rotation]}
                                    min={0}
                                    max={360}
                                    step={90}
                                    onValueChange={(v) => setRotation(v[0])}
                                    className="[&_.range-thumb]:bg-emerald-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600">Cancel</Button>
                    {!isAuthorized ? (
                        <Button
                            onClick={onAuthorize}
                            className="bg-blue-600 hover:bg-blue-700 text-white animate-pulse"
                        >
                            <Lock className="h-4 w-4 mr-2" /> Authorize Google Drive
                        </Button>
                    ) : (
                        <Button onClick={handleSave} disabled={!imageSrc} className="bg-emerald-600 hover:bg-emerald-700">
                            Confirm & Upload
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
