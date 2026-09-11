const HALF_WIDTH = 136

/**
 * Tooltip absolutely positioned inside a `relative` container: above the point,
 * or below it near the top edge, and kept within the container horizontally.
 * @param {{ x: number, y: number, containerWidth: number, children: import('react').ReactNode }} props
 */
export function FloatingTooltip({ x, y, containerWidth, children }) {
  const left = containerWidth > HALF_WIDTH * 2 ? Math.min(Math.max(x, HALF_WIDTH), containerWidth - HALF_WIDTH) : containerWidth / 2
  const below = y < 110

  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-20 w-max max-w-64 -translate-x-1/2 rounded-lg border bg-white px-3 py-2 text-xs shadow-lg ${
        below ? 'translate-y-4' : '-translate-y-[calc(100%+14px)]'
      }`}
      style={{ left, top: y }}
    >
      {children}
    </div>
  )
}
