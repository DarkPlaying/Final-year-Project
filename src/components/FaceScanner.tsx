import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle2, ShieldCheck, XCircle, Loader2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FaceScannerProps {
    mode: 'register' | 'verify';
    onComplete: (faceData?: string) => void;
    onCancel: () => void;
    userName: string;
}

export const FaceScanner: React.FC<FaceScannerProps> = ({
    mode,
    onComplete,
    onCancel,
    userName
}) => {
    const [status, setStatus] = useState<'idle' | 'initializing' | 'scanning' | 'success' | 'error'>('initializing');
    const [message, setMessage] = useState(mode === 'register' ? 'Look into the camera for registration' : 'Position your face in the frame');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const hasTriggered = useRef(false);
    const onCompleteRef = useRef(onComplete);

    // Keep ref in sync
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        let isMounted = true;
        let timeouts: NodeJS.Timeout[] = [];
        let activeStream: MediaStream | null = null;

        const startCamera = async () => {
            if (hasTriggered.current) return;

            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }
                });

                if (!isMounted) {
                    mediaStream.getTracks().forEach(track => track.stop());
                    return;
                }

                activeStream = mediaStream;
                setStream(mediaStream);

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
                setStatus('scanning');

                // Simulate "AI" face verification/registration
                const t1 = setTimeout(() => {
                    if (!isMounted) return;
                    setMessage(mode === 'register' ? 'Capturing facial features...' : 'Verifying facial features...');

                    const t2 = setTimeout(() => {
                        if (!isMounted || hasTriggered.current) return;

                        // Take a snapshot
                        if (videoRef.current && canvasRef.current) {
                            const canvas = canvasRef.current;
                            const video = videoRef.current;
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(video, 0, 0);
                                const faceData = canvas.toDataURL('image/jpeg', 0.5);

                                hasTriggered.current = true;
                                setStatus('success');
                                setMessage(mode === 'register' ? 'Face registered successfully' : 'Face verified successfully');

                                const t3 = setTimeout(() => {
                                    if (isMounted) {
                                        onCompleteRef.current(faceData);
                                        // Stop camera after completion
                                        if (activeStream) {
                                            activeStream.getTracks().forEach(track => track.stop());
                                        }
                                    }
                                }, 1500);
                                timeouts.push(t3);
                            }
                        }
                    }, 2500);
                    timeouts.push(t2);
                }, 2000);
                timeouts.push(t1);

            } catch (err) {
                if (isMounted) {
                    console.error("Camera access failed:", err);
                    setStatus('error');
                    setMessage('Camera access denied or not available');
                }
            }
        };

        startCamera();

        return () => {
            isMounted = false;
            timeouts.forEach(clearTimeout);
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [mode]); // Only re-run if mode changes


    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleCancel = () => {
        stopCamera();
        onCancel();
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in zoom-in duration-300">
            {/* Camera View */}
            <div className="relative group">
                <canvas ref={canvasRef} className="hidden" />
                {/* Glow Effect */}
                <div className={cn(
                    "absolute -inset-4 rounded-full blur-2xl opacity-20 transition-all duration-500",
                    status === 'scanning' ? "bg-blue-500 animate-pulse" :
                        status === 'success' ? "bg-green-500" :
                            status === 'error' ? "bg-red-500" : "bg-slate-500"
                )} />

                {/* Main Viewport */}
                <div className={cn(
                    "relative h-64 w-64 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-2xl overflow-hidden bg-slate-900/50 backdrop-blur-xl",
                    status === 'scanning' ? "border-blue-500 shadow-blue-500/20" :
                        status === 'success' ? "border-green-500 shadow-green-500/20" :
                            status === 'error' ? "border-red-500 shadow-red-500/20" : "border-slate-700 shadow-slate-900/20"
                )}>
                    {/* Video Element */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "absolute inset-0 h-full w-full object-cover grayscale-[20%]",
                            status === 'success' ? "grayscale-0 brightness-110" : "grayscale-[50%]"
                        )}
                        style={{ transform: 'scaleX(-1)' }}
                    />

                    {/* Scanning Face Frame */}
                    {status === 'scanning' && (
                        <div className="absolute inset-0 z-20 pointer-events-none border-[16px] border-transparent">
                            <div className="absolute inset-4 border-2 border-blue-400/30 rounded-full animate-pulse" />
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-xl" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-xl" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl" />

                            {/* Scanning Laser */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-scan-face z-30" />
                        </div>
                    )}

                    {/* Status Overlays */}
                    <div className="z-40">
                        {status === 'initializing' && <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />}
                        {status === 'success' && <CheckCircle2 className="h-20 w-20 text-green-400 animate-in zoom-in" />}
                        {status === 'error' && <XCircle className="h-20 w-20 text-red-400 animate-in zoom-in" />}
                    </div>
                </div>
            </div>

            {/* Messaging */}
            <div className="text-center space-y-2 max-w-xs">
                <div className="flex flex-col items-center gap-2">
                    <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] uppercase font-bold tracking-tighter flex items-center gap-1">
                        <Scan className="h-3 w-3" /> Step 2: Facial ID ({mode === 'register' ? 'Reg' : 'Check'})
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                        {status === 'scanning' ? (mode === 'register' ? 'Registering Face...' : 'Scanning Face...') :
                            status === 'success' ? (mode === 'register' ? 'Face Registered' : 'Face Verified') :
                                status === 'error' ? 'Scan Failed' : 'Initializing Camera'}
                    </h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed italic">
                    {message}
                </p>
            </div>

            {/* Security Chips */}
            <div className="flex flex-wrap justify-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-[10px] text-slate-300">
                    <ShieldCheck className="h-3 w-3 text-blue-400" /> Biometric Multi-Factor
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-[10px] text-slate-300">
                    <Camera className="h-3 w-3 text-emerald-400" /> Live Capture
                </div>
            </div>

            <div className="flex gap-4 w-full pt-4">
                <Button
                    variant="ghost"
                    className="flex-1 text-slate-400 hover:text-white"
                    onClick={handleCancel}
                >
                    Cancel
                </Button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan-face {
                    0% { transform: translateY(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(256px); opacity: 0; }
                }
                .animate-scan-face {
                    animation: scan-face 3s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};
