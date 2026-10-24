import { Star } from "lucide-react";

export default function StarRating({ value, onChange, readOnly = false }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            size={18}
            className={n <= (value || 0) ? "text-gold fill-current" : "text-line"}
            fill={n <= (value || 0) ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
