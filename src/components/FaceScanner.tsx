import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, RefreshCw, CheckCircle2, ShieldCheck, XCircle, Loader2, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FaceScannerProps {
    mode: 'register' | 'verify';
    onComplete: (faceData?: string) => void;
    onCancel: () => void;
    userName: string;
    expectedDescriptor?: string; // Add this
}

export const FaceScanner: React.FC<FaceScannerProps> = ({
    mode,
    onComplete,
    onCancel,
    userName,
    expectedDescriptor
}) => {
    const [status, setStatus] = useState<'idle' | 'initializing' | 'scanning' | 'success' | 'error'>('initializing');
    const [message, setMessage] = useState('Loading facial recognition models...');
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
        let activeStream: MediaStream | null = null;
        let interval: NodeJS.Timeout | null = null;

        const loadModelsAndStart = async () => {
            try {
                // Ensure models are loaded from /models directory in public folder
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
                ]);

                if (!isMounted) return;
                setMessage('Camera starting...');

                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
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

                // Start Detection Loop - Much faster polling (200ms) for real-time feel
                interval = setInterval(async () => {
                    if (!videoRef.current || hasTriggered.current || !isMounted) return;

                    const detection = await faceapi.detectSingleFace(videoRef.current)
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (detection && isMounted && !hasTriggered.current) {
                        // We found a face!
                        if (mode === 'register') {
                            handleSuccess(detection.descriptor);
                        } else {
                            // Check if we have an expected descriptor for fast-fail/fast-success
                            if (expectedDescriptor) {
                                const saved = JSON.parse(expectedDescriptor);
                                const current = Array.from(detection.descriptor);

                                let distance = 0;
                                for (let i = 0; i < saved.length; i++) {
                                    distance += Math.pow(saved[i] - current[i], 2);
                                }
                                distance = Math.sqrt(distance);

                                if (distance <= 0.45) {
                                    handleVerification(detection.descriptor, true);
                                } else {
                                    // It's a face, but not the right one. 
                                    // We show mismatch quickly instead of waiting.
                                    setStatus('error');
                                    setMessage('Face Identity Mismatch! Not ' + userName);

                                    // Don't trigger onComplete immediately, allow them to retry or fail after a short duration
                                    // but we mark it as error so the UI shows it.
                                }
                            } else {
                                handleVerification(detection.descriptor);
                            }
                        }
                    } else if (isMounted && status === 'scanning') {
                        setMessage('Searching for face...');
                    }
                }, 200);

            } catch (err) {
                if (isMounted) {
                    console.error("AI Face Initialization Error:", err);
                    setStatus('error');
                    setMessage('Failed to initialize facial recognition. Check your connection.');
                }
            }
        };

        const handleSuccess = (descriptor: Float32Array) => {
            if (hasTriggered.current) return;
            hasTriggered.current = true;

            setStatus('success');
            setMessage('Face Profile Created Successfully');

            // Store descriptor as string for Firestore
            const descriptorStr = JSON.stringify(Array.from(descriptor));

            setTimeout(() => {
                if (isMounted) {
                    onCompleteRef.current(descriptorStr);
                    stopEverything();
                }
            }, 1500);
        };

        const handleVerification = async (currentDescriptor: Float32Array, isMatch: boolean = true) => {
            if (hasTriggered.current) return;
            hasTriggered.current = true;

            if (isMatch) {
                setStatus('success');
                setMessage('Identity Confirmed');
            } else {
                setStatus('error');
                setMessage('Identity Mismatch');
            }

            const descriptorStr = JSON.stringify(Array.from(currentDescriptor));

            // Fast transition (200ms) for better UX
            setTimeout(() => {
                if (isMounted) {
                    onCompleteRef.current(descriptorStr);
                    stopEverything();
                }
            }, 200);
        };

        const stopEverything = () => {
            if (interval) clearInterval(interval);
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };

        loadModelsAndStart();

        return () => {
            isMounted = false;
            stopEverything();
        };
    }, [mode]);

    const handleCancel = () => {
        onCancel();
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="relative group">
                <canvas ref={canvasRef} className="hidden" />
                <div className={cn(
                    "absolute -inset-4 rounded-full blur-2xl opacity-20 transition-all duration-500",
                    status === 'scanning' ? "bg-blue-500 animate-pulse" :
                        status === 'success' ? "bg-green-500" :
                            status === 'error' ? "bg-red-500" : "bg-slate-500"
                )} />

                <div className={cn(
                    "relative h-64 w-64 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-2xl overflow-hidden bg-slate-900/50 backdrop-blur-xl",
                    status === 'scanning' ? "border-blue-500 shadow-blue-500/20" :
                        status === 'success' ? "border-green-500 shadow-green-500/20" :
                            status === 'error' ? "border-red-500 shadow-red-500/20" : "border-slate-700 shadow-slate-900/20"
                )}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "absolute inset-0 h-full w-full object-cover",
                            status === 'success' ? "brightness-110" : "grayscale-[30%]"
                        )}
                        style={{ transform: 'scaleX(-1)' }}
                    />

                    {status === 'scanning' && (
                        <div className="absolute inset-0 z-20 pointer-events-none border-[16px] border-transparent">
                            <div className="absolute inset-4 border-2 border-blue-400/30 rounded-full animate-pulse" />
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-xl" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-xl" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-xl" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-xl" />
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-scan-face z-30" />
                        </div>
                    )}

                    <div className="z-40">
                        {status === 'initializing' && <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />}
                        {status === 'success' && <CheckCircle2 className="h-20 w-20 text-green-400 animate-in zoom-in" />}
                        {status === 'error' && <XCircle className="h-20 w-20 text-red-400 animate-in zoom-in" />}
                    </div>
                </div>
            </div>

            <div className="text-center space-y-2 max-w-xs">
                <div className="flex flex-col items-center gap-2">
                    <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] uppercase font-bold tracking-tighter flex items-center gap-1">
                        <Scan className="h-3 w-3" /> Step 2: AI Facial Match
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">
                        {status === 'scanning' ? 'Neural Processing...' :
                            status === 'success' ? 'Identity Verified' :
                                status === 'error' ? 'Analysis Failed' : 'Initializing AI'}
                    </h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed italic">
                    {message}
                </p>
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
