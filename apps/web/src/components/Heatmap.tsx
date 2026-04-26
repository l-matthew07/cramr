import { useMemo, useRef, useState } from "react";
import { useTheme, resolveCondition } from "../lib/theme";

export interface HeatmapCell {
  date: string; // YYYY-MM-DD
  value: number;
}

interface HeatmapProps {
  cells: HeatmapCell[];
  weeks?: number;
  cellSize?: number;
  gap?: number;
  label?: string;
  quartiles?: [number, number, number, number];
}

export interface GroupHeatmapRow {
  id: string;
  displayName: string;
  cells: HeatmapCell[];
}

type HoverState = {
  x: number;
  y: number;
  date: string;
  value: number;
  displayName?: string;
};

const COLORS_DEFAULT = ["#1a1a1d", "#14432a", "#1d6b3b", "#2ea043", "#56d364"];
// Lighter palette for dark backgrounds (night / rainy) so empty cells don't disappear.
const COLORS_DARK_BG = ["#52525a", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"];

function useHeatmapColors() {
  const { condition } = useTheme();
  const active = resolveCondition(condition);
  return active === "night" || active === "rainy" ? COLORS_DARK_BG : COLORS_DEFAULT;
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function Heatmap({
  cells,
  weeks = 12,
  cellSize = 12,
  gap = 3,
  label,
}: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const COLORS = useHeatmapColors();
  const { grid, thresholds, monthLabels } = useMemo(
    () => buildGrid(cells, weeks),
    [cells, weeks],
  );

  const width = weeks * (cellSize + gap);
  const height = 7 * (cellSize + gap);

  return (
    <div className="relative" ref={containerRef}>
      {label && <div className="text-xs text-ink-400 mb-2">{label}</div>}

      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="min-w-max">
          <div className="mb-2 ml-8 flex text-[10px] text-ink-500">
            {monthLabels.map((month) => (
              <div
                key={`${month.label}-${month.week}`}
                className="shrink-0"
                style={{ width: month.spanWeeks * (cellSize + gap) }}
              >
                {month.label}
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-[102px] flex-col justify-between text-[10px] text-ink-500">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            <svg width={width} height={height} className="block overflow-visible">
              {grid.map((col, w) =>
                col.map((cell, d) => {
                  const bucket = cell ? bucketize(cell.value, thresholds) : 0;
                  return (
                    <rect
                      key={`${w}-${d}`}
                      x={w * (cellSize + gap)}
                      y={d * (cellSize + gap)}
                      width={cellSize}
                      height={cellSize}
                      rx={2}
                      fill={COLORS[bucket]}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                      onMouseMove={(event) => {
                        if (!cell) return;
                        setHovered(calcHoverState(event.clientX, event.clientY, cell, containerRef));
                      }}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                }),
              )}
            </svg>
          </div>
        </div>
      </div>

      <HeatmapLegend hovered={hovered} colors={COLORS} />
      <HeatmapTooltip hovered={hovered} />
    </div>
  );
}

export function GroupHeatmap({
  rows,
  weeks = 12,
}: {
  rows: GroupHeatmapRow[];
  weeks?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const COLORS = useHeatmapColors();
  const thresholds = useMemo(() => {
    const all = rows.flatMap((r) => r.cells.map((c) => c.value)).filter((v) => v > 0);
    return quartiles(all);
  }, [rows]);
  const dayMonthLabels = useMemo(() => buildDayMonthLabels(weeks * 7), [weeks]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="overflow-x-auto pb-4 custom-scrollbar">
        <div className="min-w-max">
          <div className="mb-2 ml-[124px] flex text-[10px] text-ink-500">
            {dayMonthLabels.map((month, i) => (
              <div
                key={`${month.label}-${i}`}
                className="shrink-0"
                style={{ width: month.spanDays * 12 }}
              >
                {month.label}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs text-ink-300 truncate">
                  {row.displayName}
                </div>
                <SingleRow
                  cells={row.cells}
                  weeks={weeks}
                  thresholds={thresholds}
                  colors={COLORS}
                  displayName={row.displayName}
                  onHover={(event, cell) =>
                    setHovered(calcHoverState(event.clientX, event.clientY, cell, containerRef, row.displayName))
                  }
                  onLeave={() => setHovered(null)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <HeatmapLegend hovered={hovered} colors={COLORS} />
      <HeatmapTooltip hovered={hovered} />
    </div>
  );
}

function SingleRow({
  cells,
  weeks,
  thresholds,
  colors,
  displayName,
  onHover,
  onLeave,
}: {
  cells: HeatmapCell[];
  weeks: number;
  thresholds: [number, number, number, number];
  colors: string[];
  displayName: string;
  onHover: (event: React.MouseEvent<HTMLSpanElement>, cell: HeatmapCell) => void;
  onLeave: () => void;
}) {
  const byDate = new Map(cells.map((c) => [c.date, c.value]));
  const days = weeks * 7;
  const orderedCells = Array.from({ length: days }).map((_, i) => {
    const d = startDateForWindow(weeks);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { date: iso, value: byDate.get(iso) ?? 0 };
  });

  return (
    <div className="flex gap-0.5">
      {orderedCells.map((cell) => {
        const bucket = bucketize(cell.value, thresholds);
        return (
          <span
            key={`${displayName}-${cell.date}`}
            className="inline-block h-2.5 w-2.5 cursor-pointer rounded-sm transition-opacity hover:opacity-90"
            style={{ background: colors[bucket] }}
            onMouseMove={(event) => onHover(event, cell)}
            onMouseLeave={onLeave}
          />
        );
      })}
    </div>
  );
}

function HeatmapLegend({ hovered, colors }: { hovered: HoverState | null; colors: string[] }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-ink-500">
      <div className="min-h-[16px] text-[11px] text-ink-400">
        {hovered ? hoverSummary(hovered) : "Hover a square to inspect a specific day."}
      </div>
      <div className="flex items-center gap-1">
        <span>less</span>
        {colors.map((c) => (
          <span
            key={c}
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: c }}
          />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}

function HeatmapTooltip({ hovered }: { hovered: HoverState | null }) {
  if (!hovered) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-ink-700 bg-ink-900/95 px-3 py-2 text-xs text-ink-100 shadow-2xl"
      style={{
        left: hovered.x,
        top: hovered.y - 10,
      }}
    >
      <div className="font-medium">{formatValue(hovered.value)}</div>
      <div className="mt-1 text-ink-400">
        {hovered.displayName ? `${hovered.displayName} · ` : ""}
        {formatDate(hovered.date)}
      </div>
    </div>
  );
}

function calcHoverState(
  clientX: number,
  clientY: number,
  cell: HeatmapCell,
  containerRef: React.RefObject<HTMLDivElement | null>,
  displayName?: string,
): HoverState {
  const bounds = containerRef.current?.getBoundingClientRect();
  return {
    x: bounds ? clientX - bounds.left : clientX,
    y: bounds ? clientY - bounds.top : clientY,
    date: cell.date,
    value: cell.value,
    displayName,
  };
}

function hoverSummary(hovered: HoverState) {
  const valueText = formatValue(hovered.value);
  const prefix = hovered.displayName ? `${hovered.displayName} studied ` : "";
  if (hovered.value <= 0) {
    return `${hovered.displayName ? `${hovered.displayName} logged` : "Logged"} no study time on ${formatDate(hovered.date)}.`;
  }
  return `${prefix}${valueText.toLowerCase()} on ${formatDate(hovered.date)}.`;
}

function formatValue(seconds: number) {
  if (seconds <= 0) return "No study logged";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min studied`;
  const hours = seconds / 3600;
  const rounded = hours >= 10 ? hours.toFixed(0) : hours.toFixed(1).replace(/\.0$/, "");
  return `${rounded} hour${Number(rounded) === 1 ? "" : "s"} studied`;
}

function formatDate(date: string) {
  return DATE_FMT.format(new Date(`${date}T12:00:00`));
}

function startDateForWindow(weeks: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = weeks * 7;
  const start = new Date(today);
  const dayOfWeek = today.getDay();
  start.setDate(today.getDate() - (days - 1 - (6 - dayOfWeek)));
  return start;
}

function buildMonthLabels(weeks: number) {
  const start = startDateForWindow(weeks);
  const labels: Array<{ label: string; week: number; spanWeeks: number }> = [];

  for (let w = 0; w < weeks; w++) {
    const weekDate = new Date(start);
    weekDate.setDate(start.getDate() + w * 7 + 3); // Check Thursday/Wednesday to align month boundaries closer to Github
    const label = MONTH_FMT.format(weekDate);
    
    const prev = labels[labels.length - 1];
    if (prev?.label === label) {
      prev.spanWeeks += 1;
    } else {
      labels.push({ label, week: w, spanWeeks: 1 });
    }
  }

  return labels;
}

function buildDayMonthLabels(days: number) {
  const start = startDateForWindow(days / 7);
  const labels: Array<{ label: string; spanDays: number }> = [];

  for (let d = 0; d < days; d++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + d);
    const label = MONTH_FMT.format(curDate);
    
    const prev = labels[labels.length - 1];
    if (prev?.label === label) {
      prev.spanDays += 1;
    } else {
      labels.push({ label, spanDays: 1 });
    }
  }

  return labels;
}

// ---------- helpers ----------

function buildGrid(cells: HeatmapCell[], weeks: number) {
  const byDate = new Map(cells.map((c) => [c.date, c]));
  const start = startDateForWindow(weeks);
  const grid: Array<Array<HeatmapCell | null>> = [];

  for (let w = 0; w < weeks; w++) {
    const col: Array<HeatmapCell | null> = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      const iso = cur.toISOString().slice(0, 10);
      col.push(byDate.get(iso) ?? { date: iso, value: 0 });
    }
    grid.push(col);
  }

  const values = cells.map((c) => c.value).filter((v) => v > 0);
  return { grid, thresholds: quartiles(values), monthLabels: buildMonthLabels(weeks) };
}

function quartiles(values: number[]): [number, number, number, number] {
  if (values.length === 0) return [1, 1, 1, 1];
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
  return [pick(0.25), pick(0.5), pick(0.75), pick(0.95)];
}

function bucketize(value: number, thresholds: [number, number, number, number]): number {
  if (value <= 0) return 0;
  if (value < thresholds[0]) return 1;
  if (value < thresholds[1]) return 2;
  if (value < thresholds[2]) return 3;
  return 4;
}
