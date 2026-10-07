import { Planet, LockSimple, ArrowRight } from "@phosphor-icons/react";
import { useEffect } from "react";
const errors: Record<string, string> = {
  account: "That account can’t open this Orbit. Choose your personal account.",
  expired: "Your sign-in request expired. Let’s try again.",
  cancelled:
    "Sign-in was cancelled. Your space will be here when you’re ready.",
  failed: "We couldn’t finish signing you in. Please try again.",
};
export function Login() {
  const error = new URLSearchParams(window.location.search).get("error");
  useEffect(() => {
    document.title = "Welcome home · Orbit";
  }, []);
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">
          <Planet size={50} weight="duotone" />
        </div>
        <span className="eyebrow">YOUR LITTLE CORNER OF THE INTERNET</span>
        <h1>
          Welcome to your orbit<span className="title-dot">.</span>
        </h1>
        <p>
          Thoughts, files, and little possibilities.
          <br />
          All together, just for you.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {errors[error] || errors.failed}
          </p>
        )}
        <a className="primary" href="/api/auth/login">
          Sign in with Google <ArrowRight size={18} aria-hidden="true" />
        </a>
        <small>
          <LockSimple size={16} aria-hidden="true" />
          Only your account can open this space.
        </small>
      </div>
    </main>
  );
}
