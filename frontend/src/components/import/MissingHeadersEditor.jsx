import { getMissingHeaders } from "../../utils/importUtils";
import "./MissingHeadersEditor.css";

export default function MissingHeadersEditor({ title, file, values, setValues }) {
  const missing = getMissingHeaders(file?.headers || []);
  if (!file || !missing.length) return null;

  return (
    <div className="missingHeadersBox">
      <b>{title}</b>

      <div className="missingHeadersSub">
        This file has missing headers. Fill them in before going to Format.
      </div>

      <div className="missingHeadersGrid">
        {missing.map((oldKey, idx) => (
          <div key={`${oldKey}-${idx}`} className="missingHeaderRow">
            <div className="missingHeaderLabel">Missing header #{idx + 1}</div>

            <input
              type="text"
              value={values[oldKey] || ""}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [oldKey]: e.target.value,
                }))
              }
              placeholder="Enter header name"
            />
          </div>
        ))}
      </div>
    </div>
  );
}