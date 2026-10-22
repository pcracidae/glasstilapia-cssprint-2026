// All backend calls go through here, so the API shape lives in one place.
// Keep these types in sync with the Pydantic models in backend/app/routes.

export type Item = { id: number; name: string; done: boolean };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  listItems: () => request<Item[]>("/items"),
  createItem: (name: string) =>
    request<Item>("/items", { method: "POST", body: JSON.stringify({ name }) }),
  deleteItem: (id: number) => request<void>(`/items/${id}`, { method: "DELETE" }),
};
