import React from "react";

/**
 * Plain button.
 *
 *   <Button name="Search" type="button" className="btn-primary" handleClick={onSearch} />
 *
 * Props: name (text/content), type ("button" | "submit"), className, handleClick, disabled.
 */
function Button({ name, type = "button", className = "btn-primary", handleClick, disabled }) {
  return (
    <button type={type} className={className} onClick={handleClick} disabled={disabled}>
      {name}
    </button>
  );
}

export default Button;
