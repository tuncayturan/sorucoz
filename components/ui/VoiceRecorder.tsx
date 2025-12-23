"use client";

import { useState, useRef, useEffect } from "react";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel?: () => void;
  buttonElement: HTMLButtonElement | null;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel, buttonElement }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    if (isRecording) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
          // Sadece kayıt süresi 0.5 saniyeden fazlaysa gönder
          if (recordingTime >= 0.5) {
            onRecordingComplete(blob);
          }
        }
        
        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        setRecordingTime(0);
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 100);
    } catch (error) {      alert("Mikrofon erişimi reddedildi. Lütfen izin verin.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Mouse events
  const handleMouseDown = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isRecording) {
      await startRecording();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    }
  };

  // Touch events
  const handleTouchStart = async (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      touchIdRef.current = e.touches[0].identifier;
      if (!isRecording) {
        await startRecording();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null && isRecording) {
      stopRecording();
      touchIdRef.current = null;
    }
  };

  const handleTouchCancel = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    }
    touchIdRef.current = null;
  };

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Kayıt göstergesi overlay
  if (isRecording) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4">
          <div className="flex flex-col items-center gap-6">
            {/* Pulsing microphone icon */}
            <div className="relative">
              <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
              </div>
              {/* Wave animation */}
              <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75"></div>
            </div>
            
            {/* Time display */}
            <div className="text-center">
              <div className="text-4xl font-bold text-red-500 mb-2">{formatTime(recordingTime)}</div>
              <p className="text-gray-600 font-medium">Kaydediliyor...</p>
              <p className="text-sm text-gray-500 mt-2">Bırakmak için parmağınızı kaldırın</p>
            </div>

            {/* Visual waveform */}
            <div className="flex items-end justify-center gap-1 h-12 w-full">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-red-500 rounded-full"
                  style={{
                    height: `${Math.random() * 40 + 20}%`,
                    animation: `waveform 0.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        
        <style jsx>{`
          @keyframes waveform {
            0%, 100% { transform: scaleY(0.5); }
            50% { transform: scaleY(1); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}

export { VoiceRecorder };
