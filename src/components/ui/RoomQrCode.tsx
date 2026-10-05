import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface RoomQrCodeProps {
  url: string;
  size?: number;
  className?: string;
}

export const RoomQrCode: React.FC<RoomQrCodeProps> = ({ url, size = 192, className = '' }) => {
  const [result, setResult] = useState<{ key: string; src: string | null } | null>(null);
  const key = `${size}|${url}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((src) => {
        if (!cancelled) setResult({ key, src });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, src: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url, size, key]);

  // Eski url'e ait sonucu gösterme.
  const src = result?.key === key ? result.src : null;
  if (!src) return null;

  return (
    <div
      className={`inline-block rounded-2xl border border-cyan-500/30 bg-white p-3 shadow-[0_0_24px_rgba(34,211,238,0.2)] ${className}`}
    >
      <img
        src={src}
        width={size}
        height={size}
        alt="Odaya katılmak için QR kod"
        className="block rounded-lg"
        draggable={false}
      />
    </div>
  );
};
