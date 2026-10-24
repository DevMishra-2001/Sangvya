import React from "react";
import { Calendar } from "primereact/calendar";
import moment from "moment";

/**
 * Date / month picker (PrimeReact Calendar) with a floating label and a calendar button.
 *
 *   <DatePicker id="date" name="date" lable="Date" value={date} handleChange={(e) => setDate(e.target.value)} />
 *   <DatePicker id="month" name="month" lable="Month" viewDate="month" value={month} handleChange={…} />
 *
 * Props: name, id, lable, value (Date), handleChange(e) — e.target.value is a Date,
 * placeholder, respclass, className, inputClassName, removeFormGroupClass, maxDate,
 * minDate, disable, viewDate ("date" | "month" | "year"), handleSelect, isRange,
 * showIcon (default true), tabIndex, dateFormat (PrimeReact format; defaults to
 * "dd/M/yy" for dates and "M-yy" for months).
 * Typing a date by hand works in DD/MM/YYYY.
 */
function DatePicker({
  name,
  className,
  respclass,
  id,
  placeholder,
  lable,
  value,
  handleChange,
  tabIndex,
  inputClassName,
  removeFormGroupClass,
  maxDate,
  minDate,
  disable,
  viewDate,
  handleSelect,
  isRange = false,
  showIcon = true,
  dateFormat,
}) {
  const view = viewDate || "date";
  // PrimeReact display format (not moment's)
  const primeDateFormat = dateFormat || (view === "month" ? "M-yy" : view === "year" ? "yy" : "dd/M/yy");

  // Accept dates typed as DD/MM/YYYY (same Date output as picking from the calendar)
  const handleManualInput = (e) => {
    const parsed = moment(e.target.value, "DD/MM/YYYY", true); // strict parsing
    if (parsed.isValid()) handleChange({ target: { name, value: parsed.toDate() } });
  };

  return (
    <div className={respclass} style={{ position: "relative" }}>
      <div className={removeFormGroupClass ? "" : "form-group"}>
        <Calendar
          inputId={id}
          showIcon={showIcon}
          placeholder={placeholder || (view === "month" ? "MMM-YYYY" : "DD/MM/YYYY")}
          className={`sg-calendar w-full ${className || ""}`}
          dateFormat={primeDateFormat}
          view={view}
          value={value && String(value) !== "Invalid Date" ? value : null}
          name={name}
          maxDate={maxDate}
          onInput={isRange || view !== "date" ? undefined : handleManualInput}
          minDate={minDate}
          disabled={disable}
          selectionMode={isRange ? "range" : "single"}
          onChange={handleChange}
          onSelect={handleSelect}
          inputClassName={`${inputClassName || ""} custom-date-input`}
          tabIndex={tabIndex || "-1"}
        />
        {lable && (
          <label htmlFor={id} className="labelPicker lable truncate">
            {lable}
          </label>
        )}
      </div>
    </div>
  );
}

export default DatePicker;
