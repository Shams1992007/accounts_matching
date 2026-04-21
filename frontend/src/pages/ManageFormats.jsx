import { useEffect, useState } from "react";
import ConfirmModal from "../components/common/ConfirmModal";
import {
  fetchFormats,
  createFormatApi,
  updateFormatApi,
  deleteFormatApi,
} from "../services/formatsApi";
import "./ManageFormats.css";

function labelToKey(label) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const EMPTY_FORM = { label: "", key: "", headers: [""] };

export default function ManageFormats() {
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // form state: null = hidden, { id } = editing, { id: null } = creating
  const [form, setForm] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchFormats();
      setFormats(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm({ id: null });
    setFormData(EMPTY_FORM);
    setFormErr("");
    setMsg("");
  };

  const openEdit = (fmt) => {
    setForm({ id: fmt.id });
    setFormData({
      label: fmt.label,
      key: fmt.key,
      headers: fmt.headers.length ? [...fmt.headers] : [""],
    });
    setFormErr("");
    setMsg("");
  };

  const closeForm = () => {
    setForm(null);
    setFormErr("");
  };

  const setHeader = (i, val) => {
    setFormData((prev) => {
      const h = [...prev.headers];
      h[i] = val;
      return { ...prev, headers: h };
    });
  };

  const addHeader = () => {
    setFormData((prev) => ({ ...prev, headers: [...prev.headers, ""] }));
  };

  const removeHeader = (i) => {
    setFormData((prev) => {
      const h = prev.headers.filter((_, idx) => idx !== i);
      return { ...prev, headers: h.length ? h : [""] };
    });
  };

  const moveHeader = (i, dir) => {
    setFormData((prev) => {
      const h = [...prev.headers];
      const j = i + dir;
      if (j < 0 || j >= h.length) return prev;
      [h[i], h[j]] = [h[j], h[i]];
      return { ...prev, headers: h };
    });
  };

  const handleLabelChange = (val) => {
    setFormData((prev) => {
      // Only auto-update key if user hasn't manually changed it
      const autoKey = labelToKey(prev.label);
      const keyIsAuto = prev.key === autoKey || prev.key === "";
      return {
        ...prev,
        label: val,
        key: keyIsAuto ? labelToKey(val) : prev.key,
      };
    });
  };

  const handleSave = async () => {
    setFormErr("");
    const label = formData.label.trim();
    const key = formData.key.trim();
    const headers = formData.headers.map((h) => h.trim()).filter(Boolean);

    if (!label) return setFormErr("Label is required.");
    if (!key) return setFormErr("Key is required.");
    if (!/^[A-Z0-9_]+$/.test(key))
      return setFormErr("Key must be uppercase letters, numbers, and underscores only.");
    if (headers.length === 0) return setFormErr("At least one header is required.");

    setSaving(true);
    try {
      if (form.id == null) {
        const created = await createFormatApi({ label, key, headers });
        setFormats((prev) => [...prev, created]);
        setMsg(`Format "${label}" created.`);
      } else {
        const updated = await updateFormatApi(form.id, { label, key, headers });
        setFormats((prev) => prev.map((f) => (f.id === form.id ? updated : f)));
        setMsg(`Format "${label}" updated.`);
      }
      setForm(null);
    } catch (e) {
      setFormErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFormatApi(deleteTarget.id);
      setFormats((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setMsg(`Format "${deleteTarget.label}" deleted.`);
      setDeleteTarget(null);
    } catch (e) {
      setErr(String(e.message || e));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mfPage">
      <div className="mfHead">
        <h2>Manage Formats</h2>
        <button className="mfNewBtn" onClick={openNew} disabled={form !== null}>
          + New Format
        </button>
      </div>

      <p className="mfSub">
        Formats define the target columns used when mapping imported files. Each format is a named
        set of headers in a fixed order.
      </p>

      {msg && <div className="mfOk">{msg}</div>}
      {err && <div className="mfErr">{err}</div>}

      {/* Create / Edit form */}
      {form !== null && (
        <div className="mfForm">
          <h3>{form.id == null ? "New Format" : "Edit Format"}</h3>

          <div className="mfFormGrid">
            <label className="mfFormLabel">
              Label
              <input
                type="text"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="e.g. QuickBooks Online"
              />
            </label>

            <label className="mfFormLabel">
              Key
              <input
                type="text"
                value={formData.key}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, key: e.target.value.toUpperCase() }))
                }
                placeholder="e.g. QBO"
              />
              <span className="mfKeyHint">Uppercase letters, numbers, underscores</span>
            </label>
          </div>

          <div className="mfHeadersLabel">Headers (in order)</div>

          <div className="mfHeadersList">
            {formData.headers.map((h, i) => (
              <div key={i} className="mfHeaderRow">
                <button
                  className="mfMoveBtn"
                  onClick={() => moveHeader(i, -1)}
                  disabled={i === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className="mfMoveBtn"
                  onClick={() => moveHeader(i, 1)}
                  disabled={i === formData.headers.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <input
                  type="text"
                  value={h}
                  onChange={(e) => setHeader(i, e.target.value)}
                  placeholder={`Column ${i + 1}`}
                />
                <button
                  className="mfRemoveBtn"
                  onClick={() => removeHeader(i)}
                  disabled={formData.headers.length === 1}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button className="mfAddHeaderBtn" onClick={addHeader}>
            + Add Column
          </button>

          {formErr && <div className="mfFormErr">{formErr}</div>}

          <div className="mfFormActions">
            <button className="mfSaveBtn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Format"}
            </button>
            <button className="mfCancelBtn" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Formats table */}
      {loading ? (
        <div className="mfLoading">Loading formats...</div>
      ) : formats.length === 0 ? (
        <div className="mfEmpty">No formats yet. Create one above.</div>
      ) : (
        <table className="mfTable">
          <thead>
            <tr>
              <th>Label</th>
              <th>Key</th>
              <th>Columns</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {formats.map((fmt) => (
              <tr key={fmt.id}>
                <td>{fmt.label}</td>
                <td>
                  <code>{fmt.key}</code>
                </td>
                <td className="mfHeaderCell">
                  {fmt.headers.map((h, i) => (
                    <span key={i} className="mfHeaderChip">
                      {h}
                    </span>
                  ))}
                </td>
                <td className="mfActions">
                  <button
                    className="mfEditBtn"
                    onClick={() => openEdit(fmt)}
                    disabled={form !== null}
                  >
                    Edit
                  </button>
                  <button
                    className="mfDeleteBtn"
                    onClick={() => setDeleteTarget(fmt)}
                    disabled={form !== null}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Format"
        message={`Delete "${deleteTarget?.label}" (${deleteTarget?.key})? This cannot be undone. Formats in use by saved mappings cannot be deleted.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        danger
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
