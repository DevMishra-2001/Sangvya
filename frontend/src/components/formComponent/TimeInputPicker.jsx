import React, { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import CustomTimePickers from "./CustomTimePicker/Index";

/**
 * Read-only time box that opens the analog clock picker. Value format "hh:mm AM".
 *
 *   <TimeInputPicker name="checkIn" lable="Time" value={time}
 *     onChange={(e) => setTime(e.target.value)} respclass="w-36" />
 *
 * Props: name, value, onChange({ target: { name, value } }), lable, id, placeholder, respclass.
 */
const TimeInputPicker = ({
  name = "time",
  value = "03:30 AM",
  onChange = () => {},
  lable = "",
  id = "time",
  placeholder = "HH:MM AM/PM",
  respclass = "",
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const wrapperRef = useRef();

  const handleTimeSelect = (hour, minute, period) => {
    setShowPicker(false);
    onChange({ target: { name, value: `${hour}:${minute} ${period}` } });
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowPicker(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`custom-time-picker-wrapper relative ${respclass}`} ref={wrapperRef}>
      <div className="flex items-center cursor-pointer relative" onClick={() => setShowPicker(true)}>
        <input
          id={id}
          name={name}
          className="w-full h-8 pl-3 pr-9 rounded-md border border-line bg-card text-ink text-sm cursor-pointer"
          value={value}
          placeholder={placeholder}
          readOnly
        />
        {lable && (
          <label htmlFor={id} className="labelPicker lable truncate">
            {lable}
          </label>
        )}
        <Clock size={15} className="absolute right-3 text-slate pointer-events-none" aria-hidden />
      </div>

      {showPicker && (
        <div className="custom-picker-popup">
          <CustomTimePickers onClose={() => setShowPicker(false)} onSelect={handleTimeSelect} initialTime={value} />
        </div>
      )}
    </div>
  );
};

export default TimeInputPicker;
