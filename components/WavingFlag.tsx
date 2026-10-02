// A flag that keeps waving: the 4:3 flag cut into vertical strips, each
// bobbing a little behind the one before, with light and shade rolling across
// the folds. Only transforms and opacity animate, so it stays on the GPU.
// Reduced motion gets a still flag (see .wave-strip in globals.css).
const STRIPS = 10;

function strips(iso: string, height: number) {
  // Whole-pixel strips, so no hairline gaps between them.
  const strip = Math.max(1, Math.round((height * 4) / 3 / STRIPS));
  const width = strip * STRIPS;
  const src = `/flags/4x3/${iso.toLowerCase()}.svg`;
  return {
    width,
    items: Array.from({ length: STRIPS }, (_, i) => ({
      width: strip,
      backgroundImage: `url(${src})`,
      backgroundSize: `${width}px ${height}px`,
      backgroundPosition: `${-i * strip}px 0`,
      animationDelay: `${-i * 0.09}s`,
    })),
  };
}

export default function WavingFlag({ iso, height = 15, className = "" }: { iso: string; height?: number; className?: string }) {
  const { width, items } = strips(iso, height);
  return (
    <span className={`wave relative inline-flex shrink-0 align-[-2px] ${className}`} style={{ width, height }} aria-hidden>
      {items.map((style, i) => (
        <span key={i} className="wave-strip block h-full" style={style} />
      ))}
      <span className="wave-shade pointer-events-none absolute inset-0" />
    </span>
  );
}

/** The same flag as an HTML string, for the map's tooltip (a MapLibre popup, not React). */
export function wavingFlagHtml(iso: string, height = 13) {
  if (!/^[A-Za-z]{2}$/.test(iso)) return "";
  const { width, items } = strips(iso, height);
  const css = (s: (typeof items)[number]) =>
    `width:${s.width}px;background-image:${s.backgroundImage};background-size:${s.backgroundSize};background-position:${s.backgroundPosition};animation-delay:${s.animationDelay}`;
  return (
    `<span class="wave relative inline-flex shrink-0" style="width:${width}px;height:${height}px" aria-hidden="true">` +
    items.map((s) => `<span class="wave-strip block h-full" style="${css(s)}"></span>`).join("") +
    `<span class="wave-shade pointer-events-none absolute inset-0"></span></span>`
  );
}
