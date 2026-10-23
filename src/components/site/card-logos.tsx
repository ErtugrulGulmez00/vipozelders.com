// Kabul edilen kart logoları (sanal POS başvuru şartı: alt bilgide ve ödeme adımında görünür olmalı).

function Badge({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span role="img" aria-label={label} className="inline-flex h-7 w-11 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-200">
      {children}
    </span>
  );
}

export function CardLogos({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Badge label="Visa">
        <svg viewBox="0 0 48 16" className="h-3 w-auto" aria-hidden>
          <text x="24" y="13.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="900" fontStyle="italic" fill="#1a1f71" letterSpacing="-0.5">
            VISA
          </text>
        </svg>
      </Badge>
      <Badge label="Mastercard">
        <svg viewBox="0 0 32 20" className="h-4 w-auto" aria-hidden>
          <circle cx="12" cy="10" r="8" fill="#eb001b" />
          <circle cx="20" cy="10" r="8" fill="#f79e1b" />
          <path d="M16 3.07a8 8 0 0 1 0 13.86 8 8 0 0 1 0-13.86z" fill="#ff5f00" />
        </svg>
      </Badge>
      <Badge label="Troy">
        <svg viewBox="0 0 48 16" className="h-3 w-auto" aria-hidden>
          <text x="24" y="13" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="15" fontWeight="800" fill="#00a6a6" letterSpacing="0.5">
            troy
          </text>
        </svg>
      </Badge>
    </span>
  );
}
