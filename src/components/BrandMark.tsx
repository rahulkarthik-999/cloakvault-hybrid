interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * CloakVault mark: a shield split into an on-device half (emerald) and a cloud half (indigo),
 * joined by a keyhole — the hybrid boundary that raw PII never crosses.
 */
export function BrandMark({ size = 28, className = '' }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#0E1015" />
      <path d="M32 11 L14 18.5 V31 C14 42.6 21.6 51.6 32 55 Z" fill="#10B981" />
      <path d="M32 11 L50 18.5 V31 C50 42.6 42.4 51.6 32 55 Z" fill="#6366F1" />
      <circle cx="32" cy="29" r="5.2" fill="#0E1015" />
      <path d="M29.4 31.5 h5.2 l1.6 10.5 h-8.4 z" fill="#0E1015" />
    </svg>
  );
}

export function Wordmark({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark size={size} />
      <span
        className={`font-display text-[22px] leading-none tracking-tight ${
          dark ? 'text-white' : 'text-[#0E1015]'
        }`}
      >
        CloakVault
      </span>
    </span>
  );
}
