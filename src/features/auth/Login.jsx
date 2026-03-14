import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/init";

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setErr("Введите email.");
      return;
    }

    if (!password) {
      setErr("Введите пароль.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      nav("/dashboard");
    } catch (e2) {
      console.error(e2);
      setErr("Не удалось войти. Проверь email и пароль.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 920, margin: "0 auto" }}>
      <section
        className="card"
        style={{
          overflow: "hidden",
          position: "relative",
          padding: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 35%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 30%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 16,
            padding: 22,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 13,
                opacity: 0.9,
              }}
            >
              <span>✦</span>
              <span>Welcome back</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Вход в SkillConnect
            </h1>

            <p
              style={{
                marginTop: 14,
                maxWidth: 700,
                opacity: 0.82,
                lineHeight: 1.6,
                fontSize: 15,
              }}
            >
              Войди в аккаунт, чтобы открыть чаты, посты, отклики и рабочую
              панель.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ opacity: 0.7, fontSize: 13 }}>После входа</div>
              <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
                dashboard, чаты, профиль и управление заказами
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Войти</h2>

        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Email</div>
            <input
              className="input"
              placeholder="Введите email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Пароль</div>
            <input
              className="input"
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {err && (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,80,80,0.08)",
                border: "1px solid rgba(255,80,80,0.18)",
                color: "#ff9b9b",
              }}
            >
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" disabled={loading}>
              {loading ? "Вхожу..." : "Войти"}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 16, opacity: 0.82 }}>
          Нет аккаунта?{" "}
          <Link to="/register" style={{ textDecoration: "none" }}>
            Зарегистрироваться
          </Link>
        </p>
      </section>
    </div>
  );
}