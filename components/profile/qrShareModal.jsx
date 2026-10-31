import { useEffect, useRef, useState } from 'react';
import { Download, Link2, Check, Share2, Loader2 } from 'lucide-react';
import Modal from '@/components/shared/modal';
import Avatar from '@/components/shared/avatar';
import { profileUrl } from '@/lib/qr';
import { t } from '@/lib/i18n/runtime';
import { APP_NAME } from '@/lib/constants';

// Carte de partage de profil avec QR code : telechargeable en PNG, copiable, partageable.
export default function QrShareModal({ profile, onClose }) {
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const url = profileUrl(profile.id);
  const name = `${profile.firstName} ${profile.lastName}`;
  const canShare = typeof navigator !== 'undefined' && Boolean(navigator.share);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 640,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#1b1640', light: '#ffffff' }
      });
      if (!cancelled.current) setQr(dataUrl);
    })();
    return () => {
      cancelled.current = true;
    };
  }, [url]);

  // Compose une carte PNG (fond degrade + QR + nom) pour le telechargement.
  async function download() {
    if (!qr) return;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3D63E8';
    ctx.fillRect(0, 0, 800, 1000);

    ctx.fillStyle = '#ffffff';
    const radius = 36;
    const x = 80;
    const y = 150;
    const size = 640;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + size, y, x + size, y + size, radius);
    ctx.arcTo(x + size, y + size, x, y + size, radius);
    ctx.arcTo(x, y + size, x, y, radius);
    ctx.arcTo(x, y, x + size, y, radius);
    ctx.closePath();
    ctx.fill();

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = qr;
    });
    ctx.drawImage(img, x + 30, y + 30, size - 60, size - 60);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '700 46px system-ui, sans-serif';
    ctx.fillText(name, 400, 900);
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.globalAlpha = 0.8;
    ctx.fillText(`${APP_NAME}`, 400, 950);
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.globalAlpha = 0.9;
    ctx.fillText(t("Scannez pour m'ajouter"), 400, 100);

    const link = document.createElement('a');
    link.download = `${APP_NAME.toLowerCase()}-${profile.firstName.toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // presse-papiers indisponible
    }
  }

  async function share() {
    try {
      await navigator.share({ title: name, text: t("Retrouvez-moi sur {APP_NAME}", { APP_NAME }), url });
    } catch (error) {
      // partage annule
    }
  }

  return (
    <Modal title={t("Partager mon profil")} onClose={onClose} maxWidth="max-w-sm">
      <div className="text-center">
        <div
          className="rounded-3xl p-5 pb-6 text-white shadow-glow"
          style={{ backgroundColor: '#3D63E8' }}
        >
          <p className="text-sm font-medium opacity-90 mb-3">{t("Scannez pour m'ajouter")}</p>
          <div className="bg-white rounded-2xl p-3 mx-auto w-56 h-56 flex items-center justify-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={t("QR code du profil")} className="w-full h-full" />
            ) : (
              <Loader2 className="animate-spin text-brand-400" />
            )}
          </div>
          <div className="flex items-center justify-center gap-2.5 mt-4">
            <Avatar src={profile.avatar} firstName={profile.firstName} lastName={profile.lastName} size="sm" />
            <p className="font-display font-semibold text-lg">{name}</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3 break-all">{url}</p>

        <div className={`grid ${canShare ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-4`}>
          <button onClick={download} disabled={!qr} className="nx-btn-secondary h-11 flex-col !gap-0.5 !py-1.5 text-xs">
            <Download size={16} />
            {t("Telecharger")}
          </button>
          <button onClick={copy} className="nx-btn-secondary h-11 flex-col !gap-0.5 !py-1.5 text-xs">
            {copied ? <Check size={16} className="text-emerald-500" /> : <Link2 size={16} />}
            {copied ? t("Lien copie") : t("Copier le lien")}
          </button>
          {canShare && (
            <button onClick={share} className="nx-btn-secondary h-11 flex-col !gap-0.5 !py-1.5 text-xs">
              <Share2 size={16} />
              {t("Partager")}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
