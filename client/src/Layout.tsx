import { Link, Navigate, Outlet } from "react-router";
import { useCurrentUser, useLogout } from "./auth/hooks";

/** Redirects to the login page when signed out. */
export function RequireAuth() {
  const me = useCurrentUser();
  if (me.isPending) return <p>Loading…</p>;
  if (me.isError) return <p role="alert" className="error">Could not reach the server: {me.error.message}</p>;
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function Layout() {
  const me = useCurrentUser();
  const logout = useLogout();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">LoreGarden</Link>
        {me.data && (
          <div className="userbar">
            <span>{me.data.displayName}</span>
            <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
