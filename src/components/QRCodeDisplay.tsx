import React from 'react';
import { QrCode, ShieldCheck, Copy, Check } from 'lucide-react';
import { formatPHP } from '../lib/pari-mutuel';

interface QRCodeDisplayProps {
  amount: number;
  provider: 'GCash' | 'Maya';
  referenceHint: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  amount,
  provider,
  referenceHint,
}) => {
  const [copied, setCopied] = React.useState(false);

  const accountName = 'FLIPTOP BATTLE WAGERING POOL';
  const accountNumber = provider === 'GCash' ? '0917-882-9912' : '0918-554-1029';

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(accountNumber.replace(/-/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGCash = provider === 'GCash';

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 text-center space-y-4 shadow-xl">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isGCash ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <span className="font-bold text-xs uppercase tracking-wider text-white">
            {isGCash ? 'Official GCash QR' : 'Official Maya QR'}
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
          Philippine QRPh
        </span>
      </div>

      {/* Styled QR Frame */}
      <div className="relative inline-block p-4 bg-white rounded-2xl shadow-2xl mx-auto border-4 border-zinc-900">
        <svg
          viewBox="0 0 100 100"
          className="w-48 h-48 mx-auto"
          shapeRendering="crispEdges"
        >
          {/* Outer finder squares */}
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {/* Top-left position marker */}
          <rect x="5" y="5" width="28" height="28" fill="#111827" />
          <rect x="9" y="9" width="20" height="20" fill="white" />
          <rect x="13" y="13" width="12" height="12" fill={isGCash ? '#007DFE' : '#059669'} />

          {/* Top-right position marker */}
          <rect x="67" y="5" width="28" height="28" fill="#111827" />
          <rect x="71" y="9" width="20" height="20" fill="white" />
          <rect x="75" y="13" width="12" height="12" fill={isGCash ? '#007DFE' : '#059669'} />

          {/* Bottom-left position marker */}
          <rect x="5" y="67" width="28" height="28" fill="#111827" />
          <rect x="9" y="71" width="20" height="20" fill="white" />
          <rect x="13" y="75" width="12" height="12" fill={isGCash ? '#007DFE' : '#059669'} />

          {/* Data pattern simulation */}
          <rect x="38" y="8" width="8" height="8" fill="#111827" />
          <rect x="50" y="8" width="12" height="8" fill="#111827" />
          <rect x="38" y="20" width="14" height="8" fill="#111827" />
          <rect x="8" y="38" width="18" height="8" fill="#111827" />
          <rect x="30" y="38" width="40" height="8" fill="#111827" />
          <rect x="74" y="38" width="18" height="8" fill="#111827" />

          <rect x="8" y="50" width="24" height="8" fill="#111827" />
          <rect x="38" y="50" width="24" height="8" fill="#111827" />
          <rect x="68" y="50" width="24" height="8" fill="#111827" />

          <rect x="38" y="62" width="14" height="8" fill="#111827" />
          <rect x="56" y="62" width="14" height="8" fill="#111827" />
          <rect x="74" y="62" width="18" height="8" fill="#111827" />

          <rect x="38" y="76" width="24" height="8" fill="#111827" />
          <rect x="68" y="76" width="14" height="8" fill="#111827" />
          <rect x="86" y="76" width="6" height="8" fill="#111827" />

          {/* Center logo badge */}
          <circle cx="50" cy="50" r="11" fill="white" />
          <circle cx="50" cy="50" r="9" fill={isGCash ? '#007DFE' : '#059669'} />
          <text
            x="50"
            y="54"
            fill="white"
            fontSize="9"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            ₱
          </text>
        </svg>

        <div className="mt-1 text-[10px] font-bold text-zinc-900 uppercase tracking-wider">
          Scan to Pay
        </div>
      </div>

      {/* Payment details to pay */}
      <div className="bg-zinc-900/90 rounded-2xl p-3 border border-zinc-800 space-y-2 text-xs text-left">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Merchant Name:</span>
          <span className="font-bold text-white text-[11px]">{accountName}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-400">Account / Mobile:</span>
          <button
            type="button"
            onClick={handleCopyNumber}
            className="flex items-center gap-1 font-mono font-bold text-amber-400 hover:text-amber-300"
          >
            {accountNumber}
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        <div className="flex justify-between items-center border-t border-zinc-800 pt-2">
          <span className="text-zinc-300 font-bold">Exact Payment Amount:</span>
          <span className="font-mono font-black text-amber-400 text-base">
            {formatPHP(amount)}
          </span>
        </div>
      </div>

      {/* Reference Notice */}
      <div className="flex items-center gap-2 text-left p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
        <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
        <span>
          Pay the exact amount shown. You will enter your transaction reference number on the next
          step.
        </span>
      </div>
    </div>
  );
};
