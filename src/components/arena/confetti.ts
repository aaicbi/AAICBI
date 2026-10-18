/** Confetti and sparkles drawn with plain page elements and the Web Animations API (no library). Skipped for people who prefer less motion. */
const COLORS = ["#f2b84b", "#ff7a85", "#7fd6a0", "#8fb7ff", "#ffffff", "#c79bff"];

export function burst(host: HTMLElement | null, opts: { count?: number; x?: number; y?: number; spread?: number; power?: number } = {}) {
  if (!host || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const { count = 40, x = 50, y = 50, spread = 360, power = 1 } = opts;
  const w = host.clientWidth || 800; const h = host.clientHeight || 400;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("i");
    const size = 6 + Math.random() * 8;
    el.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.5)}px;background:${COLORS[i % COLORS.length]};border-radius:${Math.random() > 0.6 ? "50%" : "2px"};pointer-events:none;will-change:transform,opacity`;
    host.appendChild(el);
    const ang = ((Math.random() * spread - spread / 2) - 90) * (Math.PI / 180);
    const dist = (0.25 + Math.random() * 0.55) * Math.min(w, h * 1.6) * power;
    const dx = Math.cos(ang) * dist; const dy = Math.sin(ang) * dist;
    const spin = (Math.random() - 0.5) * 900;
    el.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + h * 0.5}px)) rotate(${spin}deg) scale(.8)`, opacity: 0 },
      ],
      { duration: 1400 + Math.random() * 900, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => el.remove();
  }
}

/** A "+80" that floats up from a spot on the stage. */
export function floatText(host: HTMLElement | null, text: string, opts: { x?: number; y?: number; color?: string } = {}) {
  if (!host) return;
  const el = document.createElement("div");
  const { x = 50, y = 45, color = "#f2b84b" } = opts;
  el.textContent = text;
  el.style.cssText = `position:absolute;left:${x}%;top:${y}%;font:800 9cqh var(--font-fraunces,Georgia),serif;color:${color};text-shadow:0 .08em .2em rgba(0,0,0,.45);pointer-events:none;transform:translate(-50%,-50%);z-index:5`;
  host.appendChild(el);
  el.animate([{ transform: "translate(-50%,-30%) scale(.5)", opacity: 0 }, { transform: "translate(-50%,-60%) scale(1.15)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-140%) scale(1)", opacity: 0 }], { duration: 1500, easing: "ease-out" }).onfinish = () => el.remove();
}
