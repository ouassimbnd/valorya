/** Valorya — emblème vectoriel, palette Confiance & croissance. */
export function BrandLogo({ size = 34, inverse = false }: { size?: number; inverse?: boolean }) {
  return <svg className="brand-logo" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    <path d="M7 11h10l16 32c1.5 3 3.2 4.3 5.5 3.6L34 54c-3.2 5-10.1 4.2-12.8-1.2L3 17c-1.4-2.8.6-6 4-6Z" fill="#109B81" />
    <path d="M42 11h18L38 43c-1.1 1.7-3.6 1.6-4.6-.2L26 29l8.3-13.5C36 12.8 38.7 11 42 11Z" fill={inverse ? "#F7FAFC" : "#102D46"} />
  </svg>;
}
