import React, { useRef } from "react";
import Select, { components } from "react-select";
import Tooltip from "../Tooltip";
import { useTheme } from "../../context/ThemeContext";

const { ValueContainer, Placeholder } = components;

// Keeps the placeholder rendered (it floats up as the label once a value is chosen)
const CustomValueContainer = ({ children, ...props }) => (
  <ValueContainer {...props}>
    <Placeholder {...props} isFocused={props.isFocused} className="truncate">
      {props.selectProps.placeholder}
    </Placeholder>
    {React.Children.map(children, (child) => (child && child.type !== Placeholder ? child : null))}
  </ValueContainer>
);

// Theme colors (CSS variables from index.css) so the select follows light/dark mode
const c = (name, alpha) => (alpha ? `rgb(var(--color-${name}) / ${alpha})` : `rgb(var(--color-${name}))`);

/**
 * Searchable single-select with a floating label.
 *
 *   <ReactSelect
 *     placeholderName="Location" id="location" name="location"
 *     dynamicOptions={[{ value: "office", label: "Office" }]}
 *     value={form.location} handleChange={(name, option) => …}
 *     searchable removeIsClearable respclass="w-64"
 *   />
 *
 * Props: placeholderName (label), dynamicOptions [{ value, label }], value (the
 * option's value), handleChange(name, option), name, id, inputId, searchable,
 * defaultValue, respclass, requiredClassName, isDisabled, removeIsClearable
 * (hides the clear "x" and shows the arrow), onKeyDown, tabIndex,
 * handleFormatlabel(name, label, rest) for custom option rendering,
 * backgroundColor.
 */
const ReactSelect = ({
  placeholderName,
  searchable,
  defaultValue,
  respclass,
  id,
  handleChange,
  value,
  requiredClassName,
  dynamicOptions,
  name,
  inputId,
  isDisabled,
  removeIsClearable,
  onKeyDown,
  handleFormatlabel,
  backgroundColor,
}) => {
  const selectRef = useRef(null);
  const { isDark } = useTheme();

  const customStyles = {
    control: (base, state) => ({
      ...base,
      height: 15,
      minHeight: "2rem !important",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      flexWrap: "nowrap",
      borderColor: state.isFocused ? c("primary") : c("line"),
      boxShadow: state.isFocused ? `0 0 0 2px ${c("primary", 0.2)}` : "none",
      whiteSpace: "normal",
      borderRadius: "0.375rem",
      backgroundColor: backgroundColor || (state.isDisabled ? c("ivory") : c("card")),
      "&:hover": { borderColor: state.isFocused ? c("primary") : c("line") },
    }),
    placeholder: (base, state) => {
      const hasText = state.hasValue || state.selectProps.inputValue;
      return {
        ...base,
        position: "absolute",
        top: hasText ? "clamp(-0.45rem, -0.55rem, -0.65rem)" : "50%",
        transform: hasText ? "none" : "translateY(-50%)",
        backgroundColor: hasText ? (state.isDisabled ? c("ivory") : c("card")) : "transparent",
        padding: hasText ? "0 0.25rem" : "0",
        fontSize: hasText ? "0.6875rem" : "0.875rem",
        lineHeight: hasText ? "1" : "1.2",
        fontWeight: hasText ? 600 : 500,
        color: hasText ? c("primary") : c("slate"),
        pointerEvents: "none",
        transition: "top 0.12s cubic-bezier(0.4, 0, 0.2, 1), font-size 0.12s ease, transform 0.12s ease",
      };
    },
    singleValue: (provided) => ({ ...provided, fontSize: "0.875rem", lineHeight: 1.2, color: c("ink") }),
    input: (provided) => ({ ...provided, color: c("ink") }),
    menu: (styles) => ({
      ...styles,
      width: "100%",
      fontSize: 12,
      padding: 0,
      backgroundColor: c("card"),
      border: `1px solid ${c("line")}`,
      boxShadow: "var(--shadow-pop)",
      overflow: "hidden",
    }),
    option: (provided, state) => ({
      ...provided,
      fontSize: "0.875rem",
      lineHeight: 1.2,
      paddingTop: "0.35rem",
      paddingBottom: "0.55rem",
      paddingLeft: "0.6rem",
      paddingRight: "0.6rem",
      minHeight: "calc(1rem * 2.2)",
      display: "flex",
      alignItems: "center",
      borderBottom: `1px solid ${c("line")}`,
      color: state.isSelected ? c("primaryfg") : c("ink"),
      backgroundColor: state.isSelected ? c("primary") : state.isFocused ? c("primary", 0.1) : c("card"),
      cursor: "pointer",
    }),
    menuList: (styles) => ({ ...styles, width: "100%", fontSize: 12, padding: 0 }),
    valueContainer: (provided) => ({ ...provided, overflow: "visible" }),
    indicatorSeparator: () => ({ display: "none" }),
    clearIndicator: (provided) => ({ ...provided, color: c("slate"), padding: "0 4px" }),
    noOptionsMessage: (provided) => ({ ...provided, color: c("slate") }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  const CustomInput = ({ getDynamicClass, ...props }) => (
    <components.Input {...props} inputClassName={getDynamicClass()} />
  );
  const getDynamicClass = () => requiredClassName;

  // Arrow shown only when the clear "x" is hidden (removeIsClearable)
  const DefaultDropdownIndicator = () => (
    <div className="custom-dropdown-indicator pr-2" style={{ color: c("slate") }}>
      {removeIsClearable && (
        <svg height="18" width="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="currentColor">
          <path d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z"></path>
        </svg>
      )}
    </div>
  );

  const isMobile = window.innerWidth <= 800;
  const CustomComponent = isMobile
    ? { ValueContainer: CustomValueContainer, DropdownIndicator: DefaultDropdownIndicator }
    : {
        ValueContainer: CustomValueContainer,
        Input: (props) => <CustomInput {...props} getDynamicClass={getDynamicClass} />,
        DropdownIndicator: DefaultDropdownIndicator,
      };

  // Very long lists (>500) used a separate AutoCompleteReactSelect in the original
  // project; react-select's built-in search handles them here until that's added.
  const select = (
    <Select
      options={dynamicOptions ? dynamicOptions : []}
      isSearchable={searchable}
      defaultValue={defaultValue}
      formatOptionLabel={({ label, ...rest }) =>
        handleFormatlabel ? handleFormatlabel(name, label, rest) : <div>{label}</div>
      }
      components={CustomComponent}
      id={id}
      ref={selectRef}
      inputId={inputId}
      value={
        value !== undefined && value !== null && value !== ""
          ? dynamicOptions?.find((option) => String(option?.value) === String(value)) || null
          : defaultValue || null
      }
      styles={customStyles}
      placeholder={placeholderName}
      onChange={handleChange ? (e) => handleChange(name, e) : () => {}}
      isDisabled={isDisabled}
      className={requiredClassName}
      menuPortalTarget={document.body}
      scrollMenuIntoView={false}
      classNamePrefix={`remove-extrapadding react-select-font ${isDark ? "dark" : "light"}`}
      onKeyDown={onKeyDown}
      isClearable={!removeIsClearable}
      menuPlacement="auto"
      menuPosition="absolute"
    />
  );

  return (
    <div className={respclass}>
      <div className={isDisabled ? "form-group select-disable" : "form-group"}>
        {placeholderName ? (
          <Tooltip content={placeholderName} placement="top" className="w-full block">
            <div className="w-full">{select}</div>
          </Tooltip>
        ) : (
          select
        )}
      </div>
    </div>
  );
};

export default ReactSelect;
