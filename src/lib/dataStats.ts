type Row = Record<string, unknown>;

function isNumeric(value: unknown): value is number {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value));
  }
  return false;
}

export function summarizeDataset(columns: string[], rows: Row[]) {
  const columnStats = columns.map((col) => {
    const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== "");
    const numericValues = values.filter(isNumeric).map(Number);
    const isMostlyNumeric = values.length > 0 && numericValues.length / values.length > 0.8;

    if (isMostlyNumeric) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      return {
        column: col,
        type: "numeric" as const,
        nonEmptyCount: values.length,
        sum: Number(sum.toFixed(2)),
        avg: Number((sum / numericValues.length).toFixed(2)),
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
      };
    }

    const counts = new Map<string, number>();
    for (const v of values) {
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    return {
      column: col,
      type: "categorical" as const,
      nonEmptyCount: values.length,
      distinctCount: counts.size,
      topValues: top,
    };
  });

  return {
    rowCount: rows.length,
    columns: columnStats,
    sampleRows: rows.slice(0, 40),
  };
}
