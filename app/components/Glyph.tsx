import { PLAYA_ART } from "@/lib/icons";

/**
 * Renders one playa glyph. `currentColor` throughout, so it inherits the tab's
 * ink/paper colour rather than needing its own palette.
 */
export default function Glyph({ name, size = 22 }: { name: string; size?: number }) {
  const art = PLAYA_ART[name];
  if (!art) return null;
  return (
    <svg
      viewBox={art.viewBox}
      width={size}
      height={size}
      role="presentation"
      aria-hidden="true"
      fill="currentColor"
      style={{ display: "block", flex: "0 0 auto" }}
      dangerouslySetInnerHTML={{ __html: art.body }}
    />
  );
}
