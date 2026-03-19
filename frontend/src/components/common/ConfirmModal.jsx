import "./ConfirmModal.css";

export default function ConfirmModal({
open,
title,
message,
confirmText = "Delete",
cancelText = "Cancel",
danger = false,
onConfirm,
onCancel,
}) {
if (!open) return null;

return ( <div className="confirmOverlay"> <div className="confirmBox"> <h3>{title}</h3>
    <p>{message}</p>

    <div className="confirmActions">
      <button className="confirmCancel" onClick={onCancel}>
        {cancelText}
      </button>

      <button
        className={danger ? "confirmDanger" : "confirmPrimary"}
        onClick={onConfirm}
      >
        {confirmText}
      </button>
    </div>
  </div>
</div>
);
}

