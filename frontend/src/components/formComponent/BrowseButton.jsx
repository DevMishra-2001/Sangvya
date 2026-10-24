import React from "react";
import { Upload, CheckCircle2 } from "lucide-react";

/**
 * File picker styled as a button. Shows a check icon once a file is chosen.
 *
 *   <BrowseButton name="resume" accept=".pdf" label="Upload resume"
 *     value={file} handleImageChange={(e) => setFile(e.target.files[0])} />
 *
 * Props: ref, handleImageChange(e), accept, label (default "Browse"), className, value, name.
 */
export default function BrowseButton({ ref, handleImageChange, accept, label, className = "", value, name }) {
  const inputId = name ? name : "fileInput";
  return (
    <>
      <input type="file" id={inputId} onChange={handleImageChange} name={name} style={{ display: "none" }} accept={accept} ref={ref} />
      <label htmlFor={inputId} className={`btn-primary inline-flex !py-1.5 cursor-pointer ${className}`}>
        {label ? label : "Browse"}{" "}
        {value ? <CheckCircle2 size={15} /> : <Upload size={15} />}
      </label>
    </>
  );
}
