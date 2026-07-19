import type { Item } from "@/lib/vesti/store";
import type { BodyShape, SkinTone } from "@/lib/vesti/profile";

export const SHAPE_OPTIONS: { id: BodyShape; label: string; hint: string }[] = [
  { id: "hourglass", label: "Hourglass", hint: "Defined waist, balanced bust & hips" },
  { id: "athletic", label: "Athletic", hint: "Strong shoulders, straighter waist" },
  { id: "pear", label: "Pear", hint: "Fuller through hips & thighs" },
  { id: "straight", label: "Straight", hint: "Even bust, waist & hips" },
  { id: "petite", label: "Petite", hint: "Smaller frame, shorter proportions" },
  { id: "plus", label: "Plus", hint: "Fuller all over, soft curves" },
];

export const SKIN_TONES: { id: SkinTone; label: string; hex: string }[] = [
  { id: "porcelain", label: "Porcelain", hex: "#F2DECB" },
  { id: "fair", label: "Fair", hex: "#E6C2A4" },
  { id: "light", label: "Light", hex: "#D5A782" },
  { id: "medium", label: "Medium", hex: "#B88560" },
  { id: "tan", label: "Tan", hex: "#9A6541" },
  { id: "deep", label: "Deep", hex: "#6E4329" },
  { id: "rich", label: "Rich", hex: "#4A2C1C" },
];

const SHAPE_PROPS: Record<Exclude<BodyShape, "">, { shoulder: number; waist: number; hip: number }> = {
  hourglass: { shoulder: 1.0, waist: 0.7, hip: 1.0 },
  athletic: { shoulder: 1.06, waist: 0.88, hip: 0.9 },
  pear: { shoulder: 0.88, waist: 0.82, hip: 1.08 },
  straight: { shoulder: 0.94, waist: 0.92, hip: 0.94 },
  petite: { shoulder: 0.84, waist: 0.74, hip: 0.86 },
  plus: { shoulder: 1.12, waist: 1.08, hip: 1.14 },
};

function parseHeightInches(h: string): number {
  if (!h) return 65;
  const ft = h.match(/(\d+)\s*['ʼ′]/);
  const inch = h.match(/(\d+)\s*["ʺ″]/);
  if (ft) return Number(ft[1]) * 12 + (inch ? Number(inch[1]) : 0);
  const cm = h.match(/(\d{2,3})\s*cm/i);
  if (cm) return Math.round(Number(cm[1]) / 2.54);
  const n = Number(h.match(/\d+/)?.[0] ?? 65);
  return n > 90 ? Math.round(n / 2.54) : n;
}

function parseWeightLb(w: string): number {
  if (!w) return 140;
  const n = Number(w.match(/\d+/)?.[0] ?? 140);
  if (/kg/i.test(w)) return Math.round(n * 2.205);
  return n;
}

export interface FitModelOutfit {
  outer?: Item;
  top?: Item;
  bottom?: Item;
  shoes?: Item;
  accessory?: Item;
}

type Slot = "outer" | "top" | "bottom" | "shoes" | "accessory";

export interface FitModelProps {
  height?: string;
  weight?: string;
  shape?: BodyShape | string;
  skinTone?: SkinTone;
  outfit?: FitModelOutfit;
  onSlotClick?: (slot: Slot) => void;
  className?: string;
  /** Show the figure but no clothing overlays. */
  bare?: boolean;
}

export function FitModel({
  height,
  weight,
  shape,
  skinTone,
  outfit,
  onSlotClick,
  className,
  bare,
}: FitModelProps) {
  const shapeKey = (shape && shape in SHAPE_PROPS ? shape : "straight") as Exclude<BodyShape, "">;
  const p = SHAPE_PROPS[shapeKey];

  // Width scaling from weight (140lb ~ baseline)
  const lb = parseWeightLb(weight ?? "");
  const widthScale = Math.max(0.82, Math.min(1.25, 0.78 + (lb / 140) * 0.22));

  // Height scaling from height (65in ~ baseline). Figure occupies more of viewBox.
  const inches = parseHeightInches(height ?? "");
  const heightScale = Math.max(0.92, Math.min(1.08, 0.92 + ((inches - 60) / 12) * 0.04));

  const tone = SKIN_TONES.find((s) => s.id === skinTone)?.hex ?? "#D5A782";

  // Build silhouette in viewBox 200 x 500
  const cx = 100;
  const shoulderW = 60 * p.shoulder * widthScale;
  const waistW = 46 * p.waist * widthScale;
  const hipW = 58 * p.hip * widthScale;
  const headR = 22 * Math.sqrt(widthScale);

  // Vertical positions, slightly stretched by heightScale
  const yScale = (y: number) => 40 + (y - 40) * heightScale;
  const yHead = yScale(70);
  const yNeck = yScale(108);
  const yShoulder = yScale(128);
  const yWaist = yScale(220);
  const yHip = yScale(290);
  const yKneeIn = yScale(390);
  const yFoot = yScale(470);

  const silhouette = `
    M ${cx - shoulderW} ${yShoulder}
    C ${cx - shoulderW * 1.05} ${yShoulder + 35}, ${cx - waistW * 1.05} ${yWaist - 30}, ${cx - waistW} ${yWaist}
    C ${cx - waistW * 1.05} ${yWaist + 30}, ${cx - hipW * 1.02} ${yHip - 25}, ${cx - hipW} ${yHip}
    L ${cx + hipW} ${yHip}
    C ${cx + hipW * 1.02} ${yHip - 25}, ${cx + waistW * 1.05} ${yWaist + 30}, ${cx + waistW} ${yWaist}
    C ${cx + waistW * 1.05} ${yWaist - 30}, ${cx + shoulderW * 1.05} ${yShoulder + 35}, ${cx + shoulderW} ${yShoulder}
    Z
  `;

  // Arms (simple tapered shapes)
  const armLen = 150 * heightScale;
  const leftArm = `M ${cx - shoulderW * 0.9} ${yShoulder + 6} Q ${cx - shoulderW - 18} ${yShoulder + armLen * 0.5} ${cx - shoulderW * 0.85} ${yShoulder + armLen}`;
  const rightArm = `M ${cx + shoulderW * 0.9} ${yShoulder + 6} Q ${cx + shoulderW + 18} ${yShoulder + armLen * 0.5} ${cx + shoulderW * 0.85} ${yShoulder + armLen}`;

  // Legs
  const legW = hipW * 0.48;
  const leftLeg = `M ${cx - hipW + 4} ${yHip - 2} L ${cx - legW * 0.8} ${yHip - 2} L ${cx - legW * 0.55} ${yKneeIn} L ${cx - legW * 0.5} ${yFoot} L ${cx - legW * 1.05} ${yFoot} Z`;
  const rightLeg = `M ${cx + hipW - 4} ${yHip - 2} L ${cx + legW * 0.8} ${yHip - 2} L ${cx + legW * 0.55} ${yKneeIn} L ${cx + legW * 0.5} ${yFoot} L ${cx + legW * 1.05} ${yFoot} Z`;

  // Neck
  const neck = `M ${cx - 9} ${yNeck - 6} L ${cx - 9} ${yShoulder + 2} L ${cx + 9} ${yShoulder + 2} L ${cx + 9} ${yNeck - 6} Z`;

  // Slot rects in % of viewBox for image overlays
  const slotStyle = (left: number, top: number, width: number, height: number): React.CSSProperties => ({
    position: "absolute",
    left: `${(left / 200) * 100}%`,
    top: `${(top / 500) * 100}%`,
    width: `${(width / 200) * 100}%`,
    height: `${(height / 500) * 100}%`,
  });

  const showOverlay = !bare && outfit;
  const o = outfit ?? {};

  const topRect = slotStyle(cx - shoulderW * 1.05, yShoulder - 6, shoulderW * 2.1, yHip - yShoulder + 20);
  const outerRect = slotStyle(cx - shoulderW * 1.35, yShoulder - 10, shoulderW * 2.7, yHip - yShoulder + 60);
  const bottomRect = slotStyle(cx - hipW * 1.05, yHip - 8, hipW * 2.1, yFoot - yHip - 20);
  const shoesRect = slotStyle(cx - hipW, yFoot - 22, hipW * 2, 30);
  const accessoryRect = slotStyle(cx - 22, yNeck - 6, 44, 28);

  return (
    <div className={`relative w-full aspect-[2/5] mx-auto ${className ?? ""}`}>
      {/* Soft editorial backdrop */}
      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.6),transparent_60%)]" />
      <svg
        viewBox="0 0 200 500"
        className="relative w-full h-full"
        aria-hidden="true"
      >
        {/* Subtle floor shadow */}
        <ellipse cx={cx} cy={yFoot + 14} rx={hipW * 1.1} ry={4} fill="rgba(43,30,33,0.12)" />

        {/* Head */}
        <ellipse cx={cx} cy={yHead} rx={headR} ry={headR * 1.12} fill={tone} />
        {/* Hair suggestion — soft single sweep, gender-neutral */}
        <path
          d={`M ${cx - headR} ${yHead - 4} Q ${cx} ${yHead - headR * 1.3} ${cx + headR} ${yHead - 4} Q ${cx + headR * 0.6} ${yHead - headR * 0.4} ${cx} ${yHead - headR * 0.5} Q ${cx - headR * 0.6} ${yHead - headR * 0.4} ${cx - headR} ${yHead - 4} Z`}
          fill="rgba(43,30,33,0.18)"
        />
        {/* Neck */}
        <path d={neck} fill={tone} />
        {/* Body */}
        <path d={silhouette} fill={tone} />
        {/* Legs */}
        <path d={leftLeg} fill={tone} />
        <path d={rightLeg} fill={tone} />
        {/* Arms — strokes for elegance */}
        <path d={leftArm} stroke={tone} strokeWidth={12 * widthScale} strokeLinecap="round" fill="none" />
        <path d={rightArm} stroke={tone} strokeWidth={12 * widthScale} strokeLinecap="round" fill="none" />
      </svg>

      {/* Outfit overlays */}
      {showOverlay && (
        <>
          {o.bottom && (
            <button
              type="button"
              onClick={() => onSlotClick?.("bottom")}
              style={bottomRect}
              className="overflow-hidden rounded-md mix-blend-multiply opacity-95 transition hover:ring-2 hover:ring-mauve"
              aria-label="Swap bottom"
            >
              <img src={o.bottom.image} alt="" className="w-full h-full object-cover" />
            </button>
          )}
          {o.top && (
            <button
              type="button"
              onClick={() => onSlotClick?.("top")}
              style={topRect}
              className="overflow-hidden rounded-md mix-blend-multiply opacity-95 transition hover:ring-2 hover:ring-mauve"
              aria-label="Swap top"
            >
              <img src={o.top.image} alt="" className="w-full h-full object-cover" />
            </button>
          )}
          {o.outer && (
            <button
              type="button"
              onClick={() => onSlotClick?.("outer")}
              style={outerRect}
              className="overflow-hidden rounded-md mix-blend-multiply opacity-90 transition hover:ring-2 hover:ring-mauve"
              aria-label="Swap outer"
            >
              <img src={o.outer.image} alt="" className="w-full h-full object-cover" />
            </button>
          )}
          {o.shoes && (
            <button
              type="button"
              onClick={() => onSlotClick?.("shoes")}
              style={shoesRect}
              className="overflow-hidden rounded transition hover:ring-2 hover:ring-mauve"
              aria-label="Swap shoes"
            >
              <img src={o.shoes.image} alt="" className="w-full h-full object-cover" />
            </button>
          )}
          {o.accessory && (
            <button
              type="button"
              onClick={() => onSlotClick?.("accessory")}
              style={accessoryRect}
              className="overflow-hidden rounded-full border border-cream/60 transition hover:ring-2 hover:ring-mauve"
              aria-label="Swap accessory"
            >
              <img src={o.accessory.image} alt="" className="w-full h-full object-cover" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function FitModelStage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-b from-cream via-[#f5ede2] to-[#ece1d2] border border-ink/10 overflow-hidden ${className ?? ""}`}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/40 to-transparent" />
      {children}
    </div>
  );
}
