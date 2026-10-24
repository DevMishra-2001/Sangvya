import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Tooltip from "../Tooltip";

/**
 * Form input with a floating label — call this instead of writing <input> by hand.
 *
 *   <Input
 *     type="text" name="name" id="employeeName" lable="Employee"
 *     value={name} onChange={handleChange} respclass="w-full sm:w-64" readOnly
 *   />
 *
 * Props (same API as the shared form components):
 *   type, name, id, value, defaultValue, onChange, onBlur, onKeyDown, onInput
 *   lable             floating label (sits inside when empty, moves onto the border when focused/filled)
 *   placeholder       placeholder text (label then stays floated)
 *   placeholderLabel  small helper text under the box
 *   respclass         classes for the outer wrapper (width / grid column)
 *   className         extra classes for the <input> itself
 *   display           text alignment: "left" | "center" | "right"   (ignored if `style` is given)
 *   style             inline style for the <input>
 *   isUpperCase       show the value in UPPER CASE
 *   showTooltipCount  focus tooltip also shows the character count
 *   isArrow           false → hide the up/down arrows of a number input
 *   removeFormGroupClass  drop the default spacing wrapper
 *   inputRef, required, disabled, readOnly, max, min, maxLength, tabIndex, error (true/"message")
 * type="password" gets a show/hide eye button automatically.
 */
function Input({
  type = "text",
  name,
  className = "",
  respclass = "",
  id,
  placeholder,
  lable,
  value,
  onKeyDown,
  required,
  display,
  onChange,
  disabled,
  readOnly,
  defaultValue,
  isUpperCase,
  onBlur,
  inputRef,
  removeFormGroupClass,
  onInput,
  max,
  min,
  showTooltipCount,
  maxLength,
  tabIndex,
  isArrow = true,
  placeholderLabel,
  style,
  error,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const customStyle = style ? style : { textAlign: display ?? "left" };
  const errorText = typeof error === "string" ? error : null;

  // Trim leading spaces and join digits split by spaces ("98 76" → "9876").
  // Never applied to passwords — a space there is part of the password.
  const handleInput = (e) => {
    if (onInput) onInput(e);
    if (isPassword) return;
    e.target.value = e.target.value.replace(/^\s+/g, "").replace(/(\d)\s+(\d)/g, "$1$2");
  };

  const tooltip = lable
    ? `${lable}${showTooltipCount ? ` · Count : ${value?.length ? value.length : 0}` : ""}`
    : null;

  const input = (
    <input
      style={customStyle}
      type={isPassword && visible ? "text" : type}
      id={id}
      name={name}
      // A blank placeholder lets CSS know when the box is empty (floating label)
      placeholder={placeholder || " "}
      {...(value !== undefined
        ? { value: isUpperCase ? String(value ?? "").toUpperCase() : value ?? "" }
        : { defaultValue })}
      onKeyDown={onKeyDown}
      onChange={onChange}
      onBlur={onBlur}
      onInput={handleInput}
      autoComplete={isPassword ? "new-password" : "off"}
      step={type === "number" ? "0.01" : undefined}
      required={required}
      ref={inputRef}
      max={max}
      min={min}
      maxLength={maxLength}
      tabIndex={tabIndex}
      disabled={disabled ? disabled : false}
      readOnly={readOnly}
      aria-invalid={error ? true : undefined}
      className={`peer w-full h-8 rounded-md border text-sm transition-colors placeholder:text-transparent focus:placeholder:text-slate/60
        ${isPassword ? "pl-3 pr-10" : "px-3"}
        ${error ? "border-rust" : "border-line"}
        ${readOnly || disabled ? "bg-ivory text-slate cursor-not-allowed" : "bg-card text-ink"}
        ${type === "number" && !isArrow ? "no-spin" : ""}
        ${className}`}
    />
  );

  // input, label and eye button must stay siblings (the label's float uses `peer`)
  const box = (
        <div className="relative w-full">
          {input}

          {lable && (
            <label
              htmlFor={id}
              className={`lable pointer-events-none absolute left-2.5 px-1 rounded-sm truncate max-w-[calc(100%-1.5rem)] transition-all duration-150
                top-1/2 -translate-y-1/2 text-sm text-slate
                peer-focus:top-0 peer-focus:text-2xs peer-focus:font-semibold peer-focus:text-primary
                peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-2xs peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:text-primary
                ${error ? "!text-rust" : ""}
                ${readOnly || disabled ? "bg-ivory" : "bg-card"}`}
            >
              {lable}
            </label>
          )}

          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate hover:text-ink"
              aria-label={visible ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
  );

  return (
    <div className={`${respclass} custominputbox`}>
      <div className={removeFormGroupClass ? "" : "form-group"}>
        {tooltip ? <Tooltip content={tooltip} placement="top" className="w-full">{box}</Tooltip> : box}

        {(errorText || placeholderLabel) && (
          <span className={`placeholderLabel block mt-1 text-2xs ${errorText ? "text-rust" : "text-slate"}`}>
            {errorText || placeholderLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default Input;
