import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, XCircle, ShieldCheck, Smartphone, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface BiometricScannerProps {
    mode: 'verify' | 'register';
    onComplete: (data?: any) => void;
    onCancel: () => void;
    userName: string;
    isProcessing: boolean;
}

export const BiometricScanner: React.FC<BiometricScannerProps> = ({
    mode,
    onComplete,
    onCancel,
    userName,
    isProcessing
}) => {
    const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
    const [scanProgress, setScanProgress] = useState(0);
    const [message, setMessage] = useState(mode === 'verify' ? 'Place your finger on the sensor' : 'Scanning for initial registration');

    useEffect(() => {
        if (isProcessing) {
            setStatus('scanning');
            const interval = setInterval(() => {
                setScanProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 2;
                });
            }, 50);
            return () => clearInterval(interval);
        } else if (status === 'scanning' && !isProcessing) {
            // This is handled by the parent calling onComplete or showing error
        }
    }, [isProcessing]);

    return (
        <div className="flex flex-col items-center justify-center p-8 space-y-8 animate-in fade-in zoom-in duration-300">
            {/* Scanner Visual */}
            <div className="relative group">
                {/* Outer Glow */}
                <div className={cn(
                    "absolute -inset-4 rounded-full blur-2xl opacity-20 transition-all duration-500",
                    status === 'scanning' ? "bg-indigo-500 animate-pulse" :
                        status === 'success' ? "bg-green-500" :
                            status === 'error' ? "bg-red-500" : "bg-slate-500"
                )} />

                {/* Main Ring */}
                <div className={cn(
                    "relative h-48 w-48 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-2xl overflow-hidden bg-slate-900/50 backdrop-blur-xl",
                    status === 'scanning' ? "border-indigo-500 shadow-indigo-500/20" :
                        status === 'success' ? "border-green-500 shadow-green-500/20" :
                            status === 'error' ? "border-red-500 shadow-red-500/20" : "border-slate-700 shadow-slate-900/20"
                )}>

                    {/* Scanning Laser Line */}
                    {status === 'scanning' && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_rgba(129,140,248,0.8)] animate-scan z-20" />
                    )}

                    {/* Icon Mapping */}
                    <div className="z-10 transition-transform duration-500 transform group-hover:scale-110">
                        {status === 'success' ? (
                            <CheckCircle2 className="h-20 w-20 text-green-400 animate-in zoom-in" />
                        ) : status === 'error' ? (
                            <XCircle className="h-20 w-20 text-red-400 animate-in zoom-in" />
                        ) : (
                            <Fingerprint className={cn(
                                "h-24 w-24 transition-colors duration-500",
                                status === 'scanning' ? "text-indigo-400" : "text-slate-500"
                            )} />
                        )}
                    </div>

                    {/* Ripple Effect when processing */}
                    {status === 'scanning' && (
                        <>
                            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full animate-ping opacity-20" />
                            <div className="absolute inset-4 border-2 border-indigo-400 rounded-full animate-ping opacity-10 animation-delay-300" />
                        </>
                    )}
                </div>
            </div>

            {/* Info & Messaging */}
            <div className="text-center space-y-2 max-w-xs">
                <h3 className="text-xl font-bold text-white tracking-tight">
                    {status === 'scanning' ? 'Verifying Identity...' :
                        status === 'success' ? 'Access Granted' :
                            status === 'error' ? 'Verification Failed' : 'Biometric Auth'}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed italic">
                    Hello, <span className="text-indigo-400 font-semibold">{userName}</span>. {message}
                </p>
            </div>

            {/* Multi-Device / Security Status Chips */}
            <div className="flex flex-wrap justify-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-[10px] text-slate-300 backdrop-blur-md">
                    <ShieldCheck className="h-3 w-3 text-indigo-400" /> WebAuthn L3
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-[10px] text-slate-300 backdrop-blur-md">
                    <Smartphone className="h-3 w-3 text-emerald-400" /> Device Locked
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-[10px] text-slate-300 backdrop-blur-md">
                    <MapPin className="h-3 w-3 text-red-400" /> Geofenced
                </div>
            </div>

            {/* Progress Bar (Visible during scan) */}
            {status === 'scanning' && (
                <div className="w-full max-w-xs space-y-2">
                    <Progress value={scanProgress} className="h-1.5 bg-slate-800" />
                    <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                        <span>Secure Tunnel</span>
                        <span>{scanProgress}%</span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 w-full pt-4">
                <Button
                    variant="ghost"
                    className="flex-1 text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={onCancel}
                    disabled={isProcessing}
                >
                    Cancel
                </Button>
                {status === 'error' && (
                    <Button
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => setStatus('idle')}
                    >
                        Retry
                    </Button>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(180px); opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .animation-delay-300 {
          animation-delay: 300ms;
        }
      `}} />
        </div>
    );
};
