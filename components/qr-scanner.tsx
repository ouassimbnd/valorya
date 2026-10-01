"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/**
 * Lecteur de QR code dans la page (caméra arrière). Utilise l’API BarcodeDetector quand le navigateur la propose
 * (Chrome/Android, Edge). Sinon, on invite à utiliser l’appareil photo du téléphone : le QR ouvre directement la caisse.
 */
export function QrScanner({ onDetect, onClose }: { onDetect: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Autorisez la caméra pour scanner le QR du client.");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      setMessage("Ce navigateur ne peut pas lire les QR codes ici. Ouvrez l’appareil photo de votre téléphone et scannez le QR du client : il ouvrira directement cette caisse.");
      return;
    }
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const el = video.current;
        if (!el) return;
        el.srcObject = stream;
        await el.play();
        setMessage("Placez le QR dans le cadre.");
        const detector = new Ctor({ formats: ["qr_code"] });
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(el);
            if (codes.length && codes[0].rawValue) { stopped = true; onDetect(codes[0].rawValue); return; }
          } catch { /* image pas encore prête : on réessaie */ }
          timer = window.setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setSupported(false);
        setMessage("Caméra inaccessible. Autorisez-la dans les réglages du navigateur, ou scannez le QR avec l’appareil photo du téléphone.");
      }
    })();
    return () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [onDetect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog scanner" role="dialog" aria-modal="true" aria-label="Scanner un QR code" onClick={e => e.stopPropagation()}>
        <div className="scanner-head"><h2>Scanner un QR code</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button></div>
        {supported && <div className="scanner-view"><video ref={video} muted playsInline /><span className="scanner-frame" aria-hidden="true" /></div>}
        <p className="scanner-hint" role="status">{message}</p>
      </div>
    </div>
  );
}
