import React, { useEffect, useState } from "react";
import "./CustomTimePicker.css";

// Analog clock face: pick the hour, then the minute, toggle AM/PM, press OK.
// Used inside TimeInputPicker.
const Index = ({ onClose, onSelect, initialTime }) => {
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  const [mode, setMode] = useState("hour");
  const [selectedHour, setSelectedHour] = useState("3");
  const [selectedMinute, setSelectedMinute] = useState("30");
  const [period, setPeriod] = useState("AM");

  const handleClockClick = (value) => {
    if (mode === "hour") {
      setSelectedHour(value);
      setMode("minute");
    } else {
      setSelectedMinute(value);
    }
  };

  const handleOK = () => {
    onSelect?.(selectedHour.padStart(2, "0"), selectedMinute, period);
    onClose?.();
  };

  useEffect(() => {
    if (initialTime) {
      const [time, p] = initialTime.split(" ");
      const [h, m] = (time || "").split(":");
      if (h) setSelectedHour(String(parseInt(h, 10))); // "03" → "3" to match the clock labels
      if (m) setSelectedMinute(m.padStart(2, "0"));
      if (p) setPeriod(p.toUpperCase());
    }
  }, [initialTime]);

  return (
    <div className="custom-clock-container">
      <div className="custom-clock-header">
        <div className="custom-time-display">
          <span className="cursor-pointer" onClick={() => setMode("hour")}>{selectedHour.padStart(2, "0")}</span>:
          <span className="cursor-pointer" onClick={() => setMode("minute")}>{selectedMinute}</span>
          <span className="custom-period-toggle">
            <span className={period === "AM" ? "custom-active" : ""} onClick={() => setPeriod("AM")}>AM</span>
            <span className={period === "PM" ? "custom-active" : ""} onClick={() => setPeriod("PM")}>PM</span>
          </span>
        </div>
        {mode === "minute" && (
          <button type="button" className="custom-clock-btn" onClick={() => setMode("hour")} aria-label="Back to hours">
            &#x1F868;
          </button>
        )}
      </div>

      <div className="custom-clock-face">
        <div
          className="custom-clock-needle"
          style={{
            transform: `rotate(${mode === "hour" ? ((parseInt(selectedHour, 10) % 12) - 1) * 30 + 30 : parseInt(selectedMinute, 10) * 6}deg)`,
          }}
        ></div>

        {(mode === "hour" ? hours : minutes).map((val, i) => {
          const total = mode === "hour" ? 12 : 60;
          // Hours start at 1 (one step clockwise from 12); minutes start at 00 (top)
          const angle = ((mode === "hour" ? i + 1 : i) / total) * 360;
          const x = 95 + 70 * Math.sin((angle * Math.PI) / 180);
          const y = 95 - 70 * Math.cos((angle * Math.PI) / 180);
          const isLabel = mode === "hour" || i % 5 === 0;
          const active = (mode === "hour" && val === selectedHour) || (mode === "minute" && val === selectedMinute);

          return (
            <div
              key={val}
              className={`custom-clock-number ${isLabel ? "custom-label" : "custom-dot"} ${active ? "custom-active" : ""}`}
              style={{ left: `${x}px`, top: `${y}px`, position: "absolute" }}
              onClick={() => handleClockClick(val)}
              role="button"
              tabIndex={0}
              aria-label={`${mode} ${val}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleClockClick(val);
              }}
            >
              {isLabel ? val : ""}
            </div>
          );
        })}

        <div className="custom-clock-center-dot"></div>
      </div>

      <div className="custom-clock-actions">
        <button type="button" className="btn-primary !py-1 !px-3 text-xs" onClick={handleOK}>
          OK
        </button>
      </div>
    </div>
  );
};

export default Index;
