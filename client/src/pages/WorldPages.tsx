import { Link, useParams } from "react-router";
import { useCreateWorld, useUpdateWorld, useWorld, useWorlds } from "../worlds/hooks";
import { useState } from "react";

export function WorldListPage() {
  const worlds = useWorlds();
  const createWorld = useCreateWorld();

  return (
    <>
      <section className="card">
        <h1>Your worlds</h1>
        {worlds.isPending && <p>Loading…</p>}
        {worlds.isError && <p role="alert" className="error">{worlds.error.message}</p>}
        {worlds.isSuccess && worlds.data.length === 0 && <p>No worlds yet. Create your first one below.</p>}
        {worlds.isSuccess && worlds.data.length > 0 && (
          <ul className="world-list">
            {worlds.data.map((w) => (
              <li key={w.id}>
                <Link to={`/worlds/${w.id}`}>{w.name}</Link>
                {w.description && <span className="muted"> — {w.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>New world</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            createWorld.mutate({
              name: String(data.get("name") ?? ""),
              description: String(data.get("description") ?? ""),
            });
          }}
        >
          <label>
            Name
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Description
            <textarea name="description" rows={3} maxLength={5000} />
          </label>
          {createWorld.error && <p role="alert" className="error">{createWorld.error.message}</p>}
          <button type="submit" disabled={createWorld.isPending}>
            {createWorld.isPending ? "Creating…" : "Create world"}
          </button>
        </form>
      </section>
    </>
  );
}

export function WorldPage() {
  const { worldId = "" } = useParams();
  const world = useWorld(worldId);
  const [editing, setEditing] = useState(false);

  if (world.isPending) return <p>Loading…</p>;
  if (world.isError) {
    return (
      <section className="card">
        <p role="alert" className="error">{world.error.message}</p>
        <Link to="/">Back to your worlds</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <Link to="/">← All worlds</Link>
      {editing ? (
        <EditWorldForm
          key={world.data.updatedAt}
          worldId={worldId}
          initial={{ name: world.data.name, description: world.data.description }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <h1>{world.data.name}</h1>
          <p className="prose">{world.data.description || <span className="muted">No description yet.</span>}</p>
          <button type="button" onClick={() => setEditing(true)}>Edit</button>
        </>
      )}
    </section>
  );
}

function EditWorldForm({
  worldId,
  initial,
  onDone,
}: {
  worldId: string;
  initial: { name: string; description: string };
  onDone: () => void;
}) {
  const update = useUpdateWorld(worldId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        update.mutate(
          {
            name: String(data.get("name") ?? ""),
            description: String(data.get("description") ?? ""),
          },
          { onSuccess: onDone },
        );
      }}
    >
      <label>
        Name
        <input name="name" required maxLength={120} defaultValue={initial.name} />
      </label>
      <label>
        Description
        <textarea name="description" rows={4} maxLength={5000} defaultValue={initial.description} />
      </label>
      {update.error && <p role="alert" className="error">{update.error.message}</p>}
      <button type="submit" disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save"}
      </button>{" "}
      <button type="button" onClick={onDone}>Cancel</button>
    </form>
  );
}
