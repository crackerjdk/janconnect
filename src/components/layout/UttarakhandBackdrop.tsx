import { useState } from 'react';

export function UttarakhandBackdrop() {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-[#FAF9F6]"
    >
      {!imgErr ? (
        <>
          <img
            src="/src/assets/images/uttarakhand_hills_temples_1795512146720.jpg"
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgErr(true)}
            className="h-full w-full scale-105 object-cover object-[center_55%] opacity-[0.75]"
          />
          {/* Subtle light atmospheric veil so UI text stays crisp and bright */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF9F6]/30 via-[#FAF9F6]/15 to-[#F7F6F2]/35" />
        </>
      ) : (
        <svg
          viewBox="0 0 1440 420"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-72 w-full opacity-75"
          fill="none"
        >
          <path
            d="M0 280 L180 180 L360 240 L560 120 L760 220 L980 110 L1180 210 L1440 140 V420 H0 Z"
            fill="#0D7A6F"
            fillOpacity="0.12"
          />
          <path
            d="M0 330 C 320 270, 620 350, 960 295 C 1180 260, 1340 310, 1440 285 V420 H0 Z"
            fill="#0F2942"
            fillOpacity="0.08"
          />
        </svg>
      )}
    </div>
  );
}
