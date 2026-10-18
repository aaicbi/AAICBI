"use client";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Drag-and-drop ordering for a vertical list, with a finger or a mouse. The row follows the pointer, the others make room, and the page
 * (or the scrolling box the list sits in) scrolls when the pointer nears its edge. The arrow keys move a focused handle one place.
 * Put `ref` on the <ol>/<ul>, and spread `grip(key)` on a small handle element inside each row.
 */
export function useDragReorder(order: string[], setOrder: (next: string[]) => void, enabled: boolean) {
  const ref = useRef<HTMLOListElement>(null);
  const drag = useRef<{ key: string; startY: number; pid: number } | null>(null);
  const [dragging, setDragging] = useState<{ key: string; dy: number } | null>(null);

  const moveTo = (key: string, to: number) => {
    const from = order.indexOf(key);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
  };

  const scroller = (el: HTMLElement): HTMLElement | null => {
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
  };

  const onDown = (e: PointerEvent<HTMLElement>, key: string) => {
    if (!enabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { key, startY: e.clientY, pid: e.pointerId };
    setDragging({ key, dy: 0 });
  };

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current; const list = ref.current;
    if (!d || !list || e.pointerId !== d.pid) return;
    const rows = Array.from(list.children) as HTMLElement[];
    const i = order.indexOf(d.key);
    const me = rows[i];
    if (!me) return;
    // Scroll when the finger nears the top or bottom edge of what can be seen.
    const box = scroller(list);
    const top = box ? box.getBoundingClientRect().top : 0;
    const bottom = box ? box.getBoundingClientRect().bottom : window.innerHeight;
    const by = e.clientY < top + 44 ? -12 : e.clientY > bottom - 44 ? 12 : 0;
    if (by) { if (box) box.scrollBy(0, by); else window.scrollBy(0, by); }
    const rect = me.getBoundingClientRect();
    const centre = rect.top + rect.height / 2;
    const prev = rows[i - 1]; const next = rows[i + 1];
    if (prev && centre < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
      d.startY -= me.offsetTop - prev.offsetTop;
      moveTo(d.key, i - 1);
    } else if (next && centre > next.getBoundingClientRect().top + next.offsetHeight / 2) {
      d.startY += next.offsetTop + next.offsetHeight - (me.offsetTop + me.offsetHeight);
      moveTo(d.key, i + 1);
    }
    setDragging({ key: d.key, dy: e.clientY - d.startY });
  };

  const end = () => { drag.current = null; setDragging(null); };

  const onKey = (e: KeyboardEvent, key: string) => {
    if (!enabled) return;
    const i = order.indexOf(key);
    if (e.key === "ArrowUp") { e.preventDefault(); moveTo(key, i - 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveTo(key, i + 1); }
  };

  return {
    ref,
    dragging,
    /** Props for the handle of the row with this key. */
    grip: (key: string) => ({
      role: "button" as const, tabIndex: 0,
      onPointerDown: (e: PointerEvent<HTMLElement>) => onDown(e, key),
      onPointerMove: onMove, onPointerUp: end, onPointerCancel: end,
      onKeyDown: (e: KeyboardEvent) => onKey(e, key),
    }),
    /** Inline style for the row being dragged, so it follows the pointer. */
    rowStyle: (key: string): React.CSSProperties | undefined => (dragging?.key === key ? { transform: `translateY(${dragging.dy}px)`, zIndex: 20, position: "relative", transition: "none", animation: "none" } : undefined),
  };
}
