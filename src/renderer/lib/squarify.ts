export interface SquarifyItem {
  id: string;
  size: number;
}

export interface SquarifyRect extends SquarifyItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Squarified treemap layout (Bruls / van Wijk / Huizing). */
export function squarify(
  items: SquarifyItem[],
  x: number,
  y: number,
  width: number,
  height: number,
): SquarifyRect[] {
  const positive = items
    .filter((item) => item.size > 0)
    .sort((a, b) => b.size - a.size);
  if (positive.length === 0 || width <= 0 || height <= 0) return [];

  const total = positive.reduce((sum, item) => sum + item.size, 0);
  const result: SquarifyRect[] = [];
  layout(positive, total, x, y, width, height, result);
  return result;
}

function layout(
  items: SquarifyItem[],
  total: number,
  x: number,
  y: number,
  width: number,
  height: number,
  out: SquarifyRect[],
): void {
  if (items.length === 0 || total <= 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, width, height });
    return;
  }

  const horizontal = width >= height;
  const side = horizontal ? height : width;
  let row: SquarifyItem[] = [];
  let rowSize = 0;
  let bestWorst = Infinity;
  let index = 0;

  while (index < items.length) {
    const next = items[index];
    const trial = [...row, next];
    const trialSize = rowSize + next.size;
    const worst = worstAspect(trial, trialSize, total, side, width, height);
    if (row.length > 0 && worst > bestWorst) break;
    row = trial;
    rowSize = trialSize;
    bestWorst = worst;
    index += 1;
  }

  const rowArea = (rowSize / total) * width * height;
  placeRow(row, rowSize, rowArea, x, y, width, height, horizontal, out);

  const remaining = items.slice(index);
  const remainingSize = total - rowSize;
  if (remaining.length === 0) return;

  if (horizontal) {
    const used = rowArea / height;
    layout(remaining, remainingSize, x + used, y, Math.max(width - used, 0), height, out);
  } else {
    const used = rowArea / width;
    layout(remaining, remainingSize, x, y + used, width, Math.max(height - used, 0), out);
  }
}

function placeRow(
  row: SquarifyItem[],
  rowSize: number,
  rowArea: number,
  x: number,
  y: number,
  width: number,
  height: number,
  horizontal: boolean,
  out: SquarifyRect[],
): void {
  if (horizontal) {
    const rowWidth = rowArea / height;
    let cursor = y;
    for (const item of row) {
      const h = (item.size / rowSize) * height;
      out.push({ ...item, x, y: cursor, width: rowWidth, height: h });
      cursor += h;
    }
  } else {
    const rowHeight = rowArea / width;
    let cursor = x;
    for (const item of row) {
      const w = (item.size / rowSize) * width;
      out.push({ ...item, x: cursor, y, width: w, height: rowHeight });
      cursor += w;
    }
  }
}

function worstAspect(
  row: SquarifyItem[],
  rowSize: number,
  total: number,
  side: number,
  width: number,
  height: number,
): number {
  if (row.length === 0 || rowSize <= 0) return Infinity;
  const area = (rowSize / total) * width * height;
  const other = area / side;
  if (other <= 0) return Infinity;
  let worst = 0;
  for (const item of row) {
    const itemSide = (item.size / rowSize) * side;
    const ratio = Math.max(other / itemSide, itemSide / other);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}
