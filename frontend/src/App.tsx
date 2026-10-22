import { useEffect, useState, type FormEvent } from "react";
import { api, type Item } from "./api";

// Walking-skeleton screen: proves frontend -> backend -> frontend works.
// Replace with the real UI once the problem statement is in.
export default function App() {
  const [status, setStatus] = useState("checking…");
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then((h) => setStatus(h.status))
      .catch(() => setStatus("backend unreachable — is uvicorn running?"));
    api.listItems().then(setItems).catch(() => {});
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const item = await api.createItem(name.trim());
      setItems((prev) => [...prev, item]);
      setName("");
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }

  async function remove(id: number) {
    await api.deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <main className="container">
      <h1>glasstilapia</h1>
      <p className="status">
        Backend: <strong>{status}</strong>
      </p>

      <form onSubmit={add} className="row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a test item"
        />
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name}
            <button onClick={() => remove(item.id)} aria-label={`Delete ${item.name}`}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
