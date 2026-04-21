import { getJsonOrThrow } from "./importApi";

export async function fetchFormats() {
  const r = await fetch("/api/formats");
  return getJsonOrThrow(r);
}

export async function createFormatApi(data) {
  const r = await fetch("/api/formats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return getJsonOrThrow(r);
}

export async function updateFormatApi(id, data) {
  const r = await fetch(`/api/formats/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return getJsonOrThrow(r);
}

export async function deleteFormatApi(id) {
  const r = await fetch(`/api/formats/${id}`, { method: "DELETE" });
  return getJsonOrThrow(r);
}
