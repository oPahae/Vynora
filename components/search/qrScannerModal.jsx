import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, Loader2, ScanLine } from 'lucide-react';
import Modal from '@/components/shared/modal';
import { extractProfileId } from '@/lib/qr';
import { t } from '@/lib/i18n/runtime';

// Scanner de QR code : camera en direct (BarcodeDetector natif quand il existe,
// sinon jsQR) ou import d'une image / capture d'ecran.
export default function QrScannerModal({ onClose, onProfileId }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const doneRef = useRef(false);
  const [status, setStatus] = useState('starting'); // starting | scanning | error
  const [error, setError] = useState('');

  function handleText(text) {
    if (doneRef.current) return;
    const id = extractProfileId(text);
    if (id) {
      doneRef.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onProfileId(id);
    } else {
      setError(t("Ce QR code n'est pas un profil valide."));
    }
  }

  async function decodeSource(source, width, height) {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(source);
        if (codes.length > 0) return codes[0].rawValue;
      } catch (err) {
        // on retombe sur jsQR
      }
    }
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const jsQR = (await import('jsqr')).default;
    const result = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });
    return result ? result.data : null;
  }

  useEffect(() => {
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError(t("La camera n'est pas disponible (HTTPS requis). Importez plutot une image."));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus('scanning');

        let last = 0;
        const loop = async (time) => {
          if (stopped || doneRef.current) return;
          if (time - last > 160 && video.videoWidth > 0) {
            last = time;
            const scale = Math.min(1, 640 / video.videoWidth);
            try {
              const text = await decodeSource(video, Math.round(video.videoWidth * scale), Math.round(video.videoHeight * scale));
              if (text) handleText(text);
            } catch (err) {
              // image illisible : on continue
            }
          }
          frameRef.current = requestAnimationFrame(loop);
        };
        frameRef.current = requestAnimationFrame(loop);
      } catch (err) {
        setStatus('error');
        setError(t("Impossible d'acceder a la camera. Autorisez-la ou importez une image."));
      }
    }

    start();
    return () => {
      stopped = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      const text = await decodeSource(bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
      if (text) handleText(text);
      else setError(t("Aucun QR code detecte dans cette image."));
    } catch (err) {
      setError(t("Impossible de lire cette image."));
    }
  }

  return (
    <Modal title={t("Scanner un QR code")} onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2 p-6 text-center">
              <Camera size={32} />
            </div>
          )}
          {status === 'scanning' && (
            <>
              <div className="absolute inset-[14%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" />
              <ScanLine className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60 animate-pulse" size={40} />
            </>
          )}
        </div>

        <p className="text-sm text-slate-500 text-center">{t("Placez le QR code d'un profil dans le cadre.")}</p>
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <label className="nx-btn-secondary w-full h-11 cursor-pointer">
          <ImageUp size={16} />
          {t("Importer une image")}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      </div>
    </Modal>
  );
}
