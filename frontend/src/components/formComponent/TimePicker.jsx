import React from "react";
import { Calendar } from "primereact/calendar";

/**
 * Time-only picker (PrimeReact Calendar, 12-hour) with a floating label.
 *
 *   <TimePicker id="checkIn" name="checkIn" lable="Time" value={time} handleChange={(e) => setTime(e.value)} />
 *
 * Props: respclass, placeholderName, value (Date), handleChange, name, lable, id,
 * className, disable, removeFormControl.
 */
const TimePicker = ({ respclass, placeholderName, value, handleChange, name, lable, id, className, disable, removeFormControl }) => (
  <div className={respclass} style={{ position: "relative", marginBottom: removeFormControl ? "" : "4px" }}>
    <Calendar
      inputId={id}
      style={{ width: "100%" }}
      className={`sg-calendar w-full ${className || ""}`}
      value={value}
      onChange={handleChange}
      timeOnly
      showTime
      inputMode="text"
      hourFormat="12"
      placeholder={placeholderName}
      disabled={disable}
      name={name}
    />
    {lable && (
      <label htmlFor={id} className="label lable truncate time_Lable labelPicker">
        {lable}
      </label>
    )}
  </div>
);

export default TimePicker;
