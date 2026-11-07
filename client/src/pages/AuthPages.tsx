import { Link } from "react-router";
import { useLogin, useRegister } from "../auth/hooks";

function formValues(e: React.FormEvent<HTMLFormElement>) {
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
}

export function LoginPage() {
  const login = useLogin();
  return (
    <section className="card">
      <h1>Sign in</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = formValues(e);
          login.mutate({ email: v.email, password: v.password });
        }}
      >
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {login.error && <p role="alert" className="error">{login.error.message}</p>}
        <button type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </section>
  );
}

export function RegisterPage() {
  const register = useRegister();
  return (
    <section className="card">
      <h1>Create account</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = formValues(e);
          register.mutate({ displayName: v.displayName, email: v.email, password: v.password });
        }}
      >
        <label>
          Display name
          <input name="displayName" required maxLength={80} autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password (8+ characters)
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {register.error && <p role="alert" className="error">{register.error.message}</p>}
        <button type="submit" disabled={register.isPending}>
          {register.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
