import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { previewFontSize, saveFontSize } from "../../store/slices/authSlice";
import { FONT_SIZE } from "../../hooks/useFontSize";

const SIZES = Array.from({ length: FONT_SIZE.max - FONT_SIZE.min + 1 }, (_, i) => FONT_SIZE.min + i); // 10…17

// Font size slider (10–17, default 13). Dragging previews live; letting go
// (or clicking a number) saves it to this user's own account
// (PUT /api/settings/font-size), so it never affects anyone else.
export default function FontSizeSetting() {
  const dispatch = useDispatch();
  const current = useSelector((state) => state.auth.user?.font_size ?? FONT_SIZE.default);
  const [value, setValue] = useState(current);
  const lastSaved = useRef(current); // what the server has (the store also holds live previews)

  useEffect(() => { setValue(current); }, [current]);

  function preview(v) {
    setValue(v);
    dispatch(previewFontSize(v));
  }

  async function commit(v = value) {
    if (v === lastSaved.current) return;
    // Success / failure toasts come from the store's toastMiddleware
    const result = await dispatch(saveFontSize(v));
    if (result.error) preview(lastSaved.current); // roll back the preview
    else lastSaved.current = v;
  }

  const pct = ((value - FONT_SIZE.min) / (FONT_SIZE.max - FONT_SIZE.min)) * 100;

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Title ("← Font Size") comes from the SettingsMenu panel header */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5">
        <span className="text-2xs text-slate">A</span>
        <input
          type="range"
          min={FONT_SIZE.min}
          max={FONT_SIZE.max}
          step={1}
          value={value}
          onChange={(e) => preview(Number(e.target.value))}
          onMouseUp={() => commit()}
          onTouchEnd={() => commit()}
          onKeyUp={() => commit()}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[rgb(var(--color-primary))]"
          style={{ background: `linear-gradient(to right, rgb(var(--color-primary)) ${pct}%, rgb(var(--color-line)) ${pct}%)` }}
          aria-label="Font size"
          aria-valuetext={`${value} pixels`}
        />
        <span className="text-base text-slate">A</span>

        {/* Every size under the track; inset by the thumb's radius so each number
            sits under its stop. The current size is highlighted and clickable. */}
        <div className="col-start-2 relative h-5 mt-1.5 mx-2 tabular-nums">
          {SIZES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { preview(t); commit(t); }}
              className={`absolute -translate-x-1/2 text-2xs leading-5 px-0.5 rounded transition-colors ${
                t === value ? "text-primary font-bold" : "text-slate hover:text-ink"
              }`}
              style={{ left: `${((t - FONT_SIZE.min) / (FONT_SIZE.max - FONT_SIZE.min)) * 100}%` }}
              aria-label={`Font size ${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
