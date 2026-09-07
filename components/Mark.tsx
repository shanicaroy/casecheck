/** The UXPective mark, inline, with its own gradient id so several can share a page. */
export function Mark({ id }: { id: string }) {
  const g = `uxg-${id}`;
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.09" stopColor="#FF9162" /><stop offset="0.54" stopColor="#D87CFF" /><stop offset="0.99" stopColor="#32B7FF" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="247" fill={`url(#${g})`} />
      <path d="M129.602 273.341C132.993 306.727 163.204 374.685 256.92 379.431C292.995 381.661 368.619 363.565 382.516 273.341" fill="none" stroke="#FFFFFF" strokeWidth="72" strokeLinecap="round" />
    </svg>
  );
}
