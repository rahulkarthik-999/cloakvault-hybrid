interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** CloakVault mark: a hooded cloak guarding a locked document. */
export function BrandMark({ size = 28, className = '' }: BrandMarkProps) {
  return (
    <img
      src="/brand/mark.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** Mark + wordmark. `dark` swaps to the white-“Cloak” wordmark for dark backgrounds. */
export function Wordmark({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span className="flex items-center gap-2" aria-label="CloakVault">
      <BrandMark size={size} />
      <img
        src={dark ? '/brand/wordmark-dark.png' : '/brand/wordmark.png'}
        alt="CloakVault"
        style={{ height: Math.round(size * 0.62) }}
        className="w-auto"
        draggable={false}
      />
    </span>
  );
}
