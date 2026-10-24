import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";

// Where the bubble sits relative to the wrapped element.
const PLACEMENT = {
  top:    { bubble: "bottom-full left-1/2 -translate-x-1/2 mb-2", arrow: "top-full left-1/2 -translate-x-1/2 -mt-1" },
  bottom: { bubble: "top-full left-1/2 -translate-x-1/2 mt-2",    arrow: "bottom-full left-1/2 -translate-x-1/2 -mb-1" },
  left:   { bubble: "right-full top-1/2 -translate-y-1/2 mr-2",   arrow: "left-full top-1/2 -translate-y-1/2 -ml-1" },
  right:  { bubble: "left-full top-1/2 -translate-y-1/2 ml-2",    arrow: "right-full top-1/2 -translate-y-1/2 -mr-1" },
};

/**
 * Reusable tooltip. Wrap any element:
 *
 *   <Tooltip content="Dark mode" placement="bottom">
 *     <button>…</button>
 *   </Tooltip>
 *
 * Shows on hover and on keyboard focus, hides on Escape, and links the
 * bubble to the element with aria-describedby for screen readers.
 */
export default function Tooltip({ content, placement = "top", delay = 150, children, className = "" }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const pos = PLACEMENT[placement] || PLACEMENT.top;

  useEffect(() => () => clearTimeout(timer.current), []); // no stray timer after unmount

  if (!content) return children;

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  // Describe the wrapped element itself (works for buttons, links, inputs…)
  const child = isValidElement(children)
    ? cloneElement(children, { "aria-describedby": open ? id : undefined })
    : children;

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {child}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-ivory shadow-lg animate-[tooltip-in_120ms_ease-out] ${pos.bubble}`}
        >
          {content}
          <span className={`absolute h-2 w-2 rotate-45 bg-ink ${pos.arrow}`} aria-hidden />
        </span>
      )}
    </span>
  );
}
