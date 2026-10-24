import { MultiSelect } from "primereact/multiselect";

/**
 * Multi-select with search (PrimeReact) and a floating label.
 * Options use { name, … } (optionLabel="name").
 *
 *   <MultiSelectComp name="employees" placeholderName="Employees"
 *     dynamicOptions={[{ name: "Eve", code: "e1" }]} value={selected}
 *     handleChange={(name, value) => setSelected(value)} />
 *
 * Props: respclass, dynamicOptions, value, handleChange(name, value), name,
 * placeholderName, requiredClassName, disabled, isRemoveTemplate (don't truncate
 * long names), itemTemplate, overlayVisible, onToggle(open).
 */
const MultiSelectComp = ({
  respclass,
  dynamicOptions,
  value,
  handleChange,
  name,
  placeholderName,
  requiredClassName,
  disabled,
  isRemoveTemplate,
  itemTemplate,
  overlayVisible,
  onToggle,
}) => {
  const isMobile = window.innerWidth <= 768;

  const truncate = (str, maxLength) =>
    str?.length > maxLength && !isMobile ? str.substring(0, maxLength) + "..." : str;

  const customItemTemplate = (option) =>
    isRemoveTemplate ? <div style={{ textWrap: "auto" }}>{option?.name}</div> : <div>{truncate(option?.name, 20)}</div>;

  return (
    <div className={respclass}>
      <div className="form-controls mb-2">
        <div className="panel-hover-container relative">
          <span className={`panel-hover-label ${value && value?.length ? "active" : ""}`}>{placeholderName}</span>
          <MultiSelect
            filter
            value={value}
            onChange={(e) => handleChange(name, e.value)}
            options={dynamicOptions}
            optionLabel="name"
            placeholder={!value || !value?.length ? placeholderName : ""}
            maxSelectedLabels={3}
            className={`multiselect sg-multiselect w-full ${requiredClassName ? "required-fields" : ""}`}
            name={name}
            itemTemplate={itemTemplate ? itemTemplate : customItemTemplate}
            disabled={disabled}
            {...(overlayVisible !== undefined && { overlayVisible })}
            {...(onToggle && { onHide: () => onToggle(false), onShow: () => onToggle(true) })}
          />
        </div>
      </div>
    </div>
  );
};

export default MultiSelectComp;
