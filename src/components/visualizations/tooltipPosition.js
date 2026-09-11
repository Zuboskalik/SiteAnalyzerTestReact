/** Pointer position relative to `container`, for a tooltip that follows the mouse. */
export function pointerPosition(container, event) {
  const rect = container.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, containerWidth: rect.width }
}

/** Top-centre of `element` relative to `container`, for tooltips opened by keyboard focus. */
export function elementPosition(container, element) {
  const outer = container.getBoundingClientRect()
  const inner = element.getBoundingClientRect()
  return { x: inner.left + inner.width / 2 - outer.left, y: inner.top - outer.top, containerWidth: outer.width }
}
