import { useMemo } from "react";

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
  quartiles?: [number, number, number, number]; // optional override
}

const COLORS = ["#1a1a1d", "#14432a", "#1d6b3b", "#2ea043", "#56d364"];

export function Heatmap({
  cells,
  weeks = 12,
  cellSize = 12,
  gap = 3,
  label,
}: HeatmapProps) {
  const { grid, thresholds } = useMemo(() => buildGrid(cells, weeks), [cells, weeks]);

  const width = weeks * (cellSize + gap);
  const height = 7 * (cellSize + gap);

  return (
    <div>
      {label && <div className="text-xs text-ink-400 mb-2">{label}</div>}
      <svg width={width} height={height} className="block">
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
              >
                {cell && (
                  <title>
                    {cell.date}: {Math.round(cell.value / 60)} min
                  </title>
                )}
              </rect>
            );
          }),
        )}
      </svg>
      <HeatmapLegend />
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="mt-2 flex items-center gap-1 text-[10px] text-ink-500">
      <span>less</span>
      {COLORS.map((c) => (
        <span
          key={c}
          className="inline-block w-2.5 h-2.5 rounded-sm"
          style={{ background: c }}
        />
      ))}
      <span>more</span>
    </div>
  );
}

export interface GroupHeatmapRow {
  id: string;
  displayName: string;
  cells: HeatmapCell[];
}

export function GroupHeatmap({
  rows,
  weeks = 12,
}: {
  rows: GroupHeatmapRow[];
  weeks?: number;
}) {
  const thresholds = useMemo(() => {
    const all = rows.flatMap((r) => r.cells.map((c) => c.value)).filter((v) => v > 0);
    return quartiles(all);
  }, [rows]);

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-xs text-ink-300 truncate">
            {row.displayName}
          </div>
          <SingleRow cells={row.cells} weeks={weeks} thresholds={thresholds} />
        </div>
      ))}
    </div>
  );
}

function SingleRow({
  cells,
  weeks,
  thresholds,
}: {
  cells: HeatmapCell[];
  weeks: number;
  thresholds: [number, number, number, number];
}) {
  const byDate = new Map(cells.map((c) => [c.date, c.value]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = weeks * 7;

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: days }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (days - 1 - i));
        const iso = d.toISOString().slice(0, 10);
        const v = byDate.get(iso) ?? 0;
        const bucket = bucketize(v, thresholds);
        return (
          <span
            key={iso}
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: COLORS[bucket] }}
            title={`${iso}: ${Math.round(v / 60)} min`}
          />
        );
      })}
    </div>
  );
}

// ---------- helpers ----------

function buildGrid(cells: HeatmapCell[], weeks: number) {
  const byDate = new Map(cells.map((c) => [c.date, c]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Align last column to current week. We render `weeks` columns, 7 rows each (Sun-Sat).
  const grid: Array<Array<HeatmapCell | null>> = [];
  const days = weeks * 7;
  const start = new Date(today);
  // Shift start back so grid ends on today.
  const dayOfWeek = today.getDay();
  start.setDate(today.getDate() - (days - 1 - (6 - dayOfWeek)));

  for (let w = 0; w < weeks; w++) {
    const col: Array<HeatmapCell | null> = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      if (cur > today) {
        col.push(null);
        continue;
      }
      const iso = cur.toISOString().slice(0, 10);
      col.push(byDate.get(iso) ?? { date: iso, value: 0 });
    }
    grid.push(col);
  }

  const values = cells.map((c) => c.value).filter((v) => v > 0);
  return { grid, thresholds: quartiles(values) };
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
