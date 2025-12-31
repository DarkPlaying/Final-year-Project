import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, RefreshCw, CheckCircle2, XCircle, Loader2, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FaceScannerProps {
    mode: 'register' | 'verify';
    onComplete: (faceData?: string) => void;
    onCancel: () => void;
    userName: string;
    expectedDescriptor?: string;
}

export const FaceScanner: React.FC<FaceScannerProps> = ({
    mode,
    onComplete,
    onCancel,
    userName,
    expectedDescriptor
}) => {
    const [status, setStatus] = useState<'initializing' | 'scanning' | 'success' | 'error'>('initializing');
    const [message, setMessage] = useState('Initializing AI Face Lock...');
    const [stream, setStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const hasTriggered = useRef(false);
    const isMounted = useRef(true);
    const onCompleteRef = useRef(onComplete);
    const expectedDescriptorRef = useRef(expectedDescriptor);

    // Keep refs up to date without triggering useEffect
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        expectedDescriptorRef.current = expectedDescriptor;
    }, [expectedDescriptor]);

    // Stop all media tracks
    const stopEverything = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    useEffect(() => {
        isMounted.current = true;
        hasTriggered.current = false;

        async function setup() {
            try {
                // 1. Load Models
                const modelPath = '/models';
                const nets = faceapi.nets;

                if (!nets.ssdMobilenetv1.isLoaded || !nets.faceLandmark68Net.isLoaded || !nets.faceRecognitionNet.isLoaded) {
                    setMessage('Loading AI Neural Engines...');
                    await Promise.all([
                        nets.ssdMobilenetv1.loadFromUri(modelPath),
                        nets.faceLandmark68Net.loadFromUri(modelPath),
                        nets.faceRecognitionNet.loadFromUri(modelPath)
                    ]);
                }

                if (!isMounted.current) return;

                // 2. Setup Camera
                setMessage('Connecting Secure Camera...');
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });

                if (!isMounted.current) {
                    mediaStream.getTracks().forEach(t => t.stop());
                    return;
                }

                setStream(mediaStream);
                if (videoRef.current && isMounted.current) {
                    videoRef.current.srcObject = mediaStream;
                    try {
                        await videoRef.current.play();
                    } catch (err: any) {
                        if (err.name === 'AbortError') {
                            console.warn("FaceScanner: play() interrupted.");
                        } else {
                            throw err;
                        }
                    }
                }

                setStatus('scanning');
                setMessage(mode === 'register' ? 'Look steady at the camera' : 'Scanning face for matching...');

                // 3. Start Inference Loop with warm-up
                setTimeout(() => {
                    if (isMounted.current) runInference();
                }, 800);

            } catch (err: any) {
                console.error("Setup Error:", err);
                if (isMounted.current) {
                    setStatus('error');
                    setMessage(err.name === 'NotAllowedError' ? 'Camera access denied' : 'Neural system failure');
                }
            }
        }

        async function runInference() {
            if (!isMounted.current || hasTriggered.current || !videoRef.current) return;

            try {
                if (videoRef.current.readyState < 2) {
                    requestAnimationFrame(() => runInference());
                    return;
                }

                const detection = await faceapi.detectSingleFace(
                    videoRef.current,
                    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
                )
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection && isMounted.current && !hasTriggered.current) {
                    const currentDescriptor = detection.descriptor;
                    const expected = expectedDescriptorRef.current;

                    if (mode === 'register') {
                        hasTriggered.current = true;
                        setStatus('success');
                        setMessage('Face Profile Secured');
                        const dataStr = JSON.stringify(Array.from(currentDescriptor));
                        setTimeout(() => {
                            if (isMounted.current) {
                                onCompleteRef.current(dataStr);
                            }
                        }, 1500);
                    } else if (expected) {
                        try {
                            const current = Array.from(currentDescriptor);
                            let distance = 0;
                            const savedDescriptor = typeof expected === 'string' ? JSON.parse(expected) : expected;

                            for (let i = 0; i < savedDescriptor.length; i++) {
                                distance += Math.pow(savedDescriptor[i] - current[i], 2);
                            }
                            distance = Math.sqrt(distance);

                            if (distance <= 0.6) {
                                hasTriggered.current = true;
                                setStatus('success');
                                setMessage('Identity Confirmed: Face Matched');
                                setTimeout(() => {
                                    if (isMounted.current) {
                                        onCompleteRef.current(JSON.stringify(current));
                                    }
                                }, 1200);
                            } else {
                                setMessage(`Identity Verification Pending... Reposition Face`);
                                if (isMounted.current && !hasTriggered.current) {
                                    setTimeout(() => runInference(), 200);
                                }
                            }
                        } catch (e) {
                            console.error("Match Logic Error:", e);
                            if (isMounted.current && !hasTriggered.current) {
                                setTimeout(() => runInference(), 500);
                            }
                        }
                    } else {
                        hasTriggered.current = true;
                        setStatus('success');
                        setMessage('Face Captured Successfully!');
                        setTimeout(() => {
                            if (isMounted.current) {
                                onCompleteRef.current(JSON.stringify(Array.from(currentDescriptor)));
                            }
                        }, 1000);
                    }
                } else {
                    if (isMounted.current && !hasTriggered.current) {
                        setMessage('Center your face in the frame');
                        setTimeout(() => runInference(), 200);
                    }
                }
            } catch (err) {
                console.error("Inference Error:", err);
                if (isMounted.current && !hasTriggered.current) {
                    setTimeout(() => runInference(), 1000);
                }
            }
        }

        const setupTimeout = setTimeout(() => {
            if (isMounted.current) {
                setStatus(current => {
                    if (current === 'initializing') {
                        setMessage('Neural system timed out. Please refresh or try again.');
                        return 'error';
                    }
                    return current;
                });
            }
        }, 45000);

        setup();

        return () => {
            isMounted.current = false;
            clearTimeout(setupTimeout);
            stopEverything();
        };
    }, [mode]);

    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0 opacity-30" />
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0 opacity-30" />

            <div className="relative">
                {/* Glow Ring */}
                <div className={cn(
                    "absolute -inset-4 rounded-full blur-2xl opacity-20 transition-all duration-700",
                    status === 'scanning' ? "bg-blue-500 animate-pulse" :
                        status === 'success' ? "bg-green-500" :
                            status === 'error' ? "bg-red-500" : "bg-blue-900"
                )} />

                {/* Video Container */}
                <div className={cn(
                    "relative h-64 w-64 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-2xl overflow-hidden bg-slate-950",
                    status === 'scanning' ? "border-blue-500 shadow-blue-500/20" :
                        status === 'success' ? "border-green-500 shadow-green-500/20" :
                            status === 'error' ? "border-red-500 shadow-red-500/20" : "border-slate-800"
                )}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={cn(
                            "absolute inset-0 h-full w-full object-cover transition-transform duration-700",
                            status === 'success' ? "scale-105" : "scale-110"
                        )}
                        style={{ transform: 'scaleX(-1)' }}
                    />

                    {/* Scanning Animation Overlay */}
                    {status === 'scanning' && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-400/80 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-scan-line" />
                        </div>
                    )}

                    {/* Status Icons */}
                    <div className="relative z-20">
                        {status === 'initializing' && <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />}
                        {status === 'success' && <CheckCircle2 className="h-20 w-20 text-green-400 animate-in zoom-in duration-500" />}
                        {status === 'error' && <XCircle className="h-20 w-20 text-red-400 animate-in zoom-in duration-500" />}
                    </div>
                </div>
            </div>

            <div className="text-center space-y-3">
                <div className="flex flex-col items-center gap-1.5">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5">
                        <ScanFace className="h-3.5 w-3.5" /> Neural Secure Scan
                    </span>
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                        {status === 'initializing' ? 'System Loading' :
                            status === 'scanning' ? 'Scanning Bio-Identity' :
                                status === 'success' ? 'Authenticated' : 'Access Denied'}
                    </h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed font-medium min-h-[1.25rem]">
                    {message}
                </p>
            </div>

            {status === 'error' && (
                <Button
                    className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-6"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart Neural System
                </Button>
            )}

            <div className="w-full pt-4 border-t border-slate-800">
                <Button
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all"
                    onClick={onCancel}
                >
                    Cancel Scan
                </Button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan-line {
                    0% { top: 10%; opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 2s linear infinite;
                }
            `}} />
        </div>
    );
};
