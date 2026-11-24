import { useId } from 'react';

interface BrandNameProps {
  accent?: boolean;
  showMap?: boolean;
}

export function UttarakhandColorMap({ className = 'h-7 w-auto' }: { className?: string }) {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 72 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Colorful map of Uttarakhand"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M13 8 L22 4 L30 3 L37 8 L45 11 L53 15 L63 21 L66 26 L61 33 L59 41 L55 47 L45 46 L36 41 L28 38 L19 38 L11 33 L8 25 L10 17 Z" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Garhwal North-West (Uttarkashi, Dehradun, Tehri) */}
        <path d="M0 0 H33 L29 28 L0 26 Z" fill="#0D7A6F" />
        {/* High Himalayas Central (Chamoli, Rudraprayag) */}
        <path d="M31 0 H52 L44 29 L27 28 Z" fill="#2563EB" />
        {/* Kumaon Highlands (Pithoragarh, Bageshwar, Almora, Champawat) */}
        <path d="M50 0 H72 V52 H44 L42 26 Z" fill="#EA580C" />
        {/* Foothills & Terai (Haridwar, Pauri, Nainital, Udham Singh Nagar) */}
        <path d="M0 24 L44 26 L48 52 H0 Z" fill="#16A34A" />
        {/* Subtle regional accent highlight in central Garhwal/Kumaon */}
        <path d="M22 20 L46 21 L43 37 L20 35 Z" fill="#F59E0B" fillOpacity="0.88" />

        {/* Clean internal district/region boundary lines */}
        <path
          d="M31 2 L28 24 M49 12 L43 27 M9 24 L43 26 M43 26 L46 47 M22 25 L20 38 M35 26 L36 42"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* Crisp state silhouette border */}
      <path
        d="M13 8 L22 4 L30 3 L37 8 L45 11 L53 15 L63 21 L66 26 L61 33 L59 41 L55 47 L45 46 L36 41 L28 38 L19 38 L11 33 L8 25 L10 17 Z"
        stroke="#0F2942"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandName({ accent = false, showMap = false }: BrandNameProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-baseline">
        <span lang="hi" className={accent ? 'text-[#0D7A6F]' : undefined}>
          जन
        </span>
        <span>Connect</span>
      </span>
      {showMap && <UttarakhandColorMap className="h-7 w-auto shrink-0" />}
    </span>
  );
}
