import React, { useState, useEffect } from "react";
import { toast } from "../Toast";

/**
 * MM/YY text input (e.g. card / document expiry). Digits only, auto-formatted.
 * With name="expDate", months before the current one are rejected.
 *
 *   <CustomDateInput name="expDate" value={exp} onChange={(value, index, name) => …} />
 *
 * Props: value, onChange(value, index, name), index, className, disabled, name.
 */
const CustomDateInput = ({ value, onChange, index, className = "", disabled, name }) => {
  const [inputValue, setInputValue] = useState(value || "");

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleInputChange = (e) => {
    let next = e.target.value.replace(/\D/g, ""); // digits only

    if (next === "") {
      setInputValue("");
      onChange("", index, name);
      return;
    }

    let month = next.slice(0, 2);
    const year = next.slice(2);

    // "5" → "05"
    if (month.length === 1 && parseInt(month, 10) > 1) {
      month = "0" + month;
      next = month + year;
    }

    // Month must be 01–12
    if (month.length === 2 && (parseInt(month, 10) < 1 || parseInt(month, 10) > 12)) return;

    if (next.length > 2) next = `${month}/${year}`;
    if (next.length > 5) next = next.slice(0, 5);

    // Expiry dates can't be in the past
    if (name === "expDate" && next.length === 5) {
      const [mm, yy] = next.split("/");
      const expDate = new Date(`20${yy}`, Number(mm) - 1, 1);
      const today = new Date();
      today.setDate(1);
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        toast.error("Expiry date cannot be earlier than the current month.");
        return;
      }
    }

    setInputValue(next);
    onChange(next, index, name);
  };

  return (
    <input
      disabled={disabled}
      type="text"
      className={`h-8 px-2 rounded-md border border-line bg-card text-ink text-sm ${className}`}
      placeholder="MM/YY"
      value={inputValue}
      onChange={handleInputChange}
      maxLength={5}
    />
  );
};

export default CustomDateInput;
