import Link from "next/link";

type BrandLogoProps = {
  href?: string | null;
  /** transparent = cutout wordmark, dark = dark-UI wordmark, icon = app icon (no white mat) */
  variant?: "transparent" | "dark" | "icon" | "light";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
};

const SOURCES = {
  light: { src: "/images/visamile-logo-transparent.png", width: 888, height: 273 },
  transparent: { src: "/images/visamile-logo-transparent.png", width: 888, height: 273 },
  dark: { src: "/images/visamile-logo-dark-transparent.png", width: 892, height: 283 },
  icon: { src: "/images/visamile-icon.png", width: 947, height: 944 },
} as const;

const HEIGHT_PX = {
  light: { sm: 36, md: 48, lg: 56, xl: 72 },
  transparent: { sm: 36, md: 48, lg: 56, xl: 72 },
  dark: { sm: 36, md: 48, lg: 56, xl: 72 },
  icon: { sm: 36, md: 44, lg: 56, xl: 72 },
} as const;

/**
 * Official Visamile brand assets. Prefer this over plain text "Visamile".
 */
export function BrandLogo({
  href = "/",
  variant = "transparent",
  size = "md",
  className = "",
  priority,
}: BrandLogoProps) {
  const asset = SOURCES[variant];
  const heightPx = HEIGHT_PX[variant][size];
  const widthPx = Math.round((heightPx * asset.width) / asset.height);

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      alt="Visamile — Visa Made Simple. Travel Made Easy."
      width={widthPx}
      height={heightPx}
      decoding="async"
      className={["block shrink-0 bg-transparent", className].filter(Boolean).join(" ")}
      style={{ width: widthPx, height: heightPx, objectFit: "contain" }}
      {...(priority ? { fetchPriority: "high" as const } : {})}
    />
  );

  if (href === null) return img;
  return (
    <Link href={href} className="inline-flex items-center bg-transparent" aria-label="Visamile home">
      {img}
    </Link>
  );
}
