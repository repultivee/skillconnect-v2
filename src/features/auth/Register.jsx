import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase/init";

export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErr("Введите email.");
      return;
    }

    if (password.length < 6) {
      setErr("Пароль минимум 6 символов.");
      return;
    }

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = cred.user;

      if (trimmedName) {
        await updateProfile(user, { displayName: trimmedName });
      }

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        role: "client",
        displayName: trimmedName || "User",
        username: trimmedName
          ? trimmedName.toLowerCase().replace(/\s+/g, "_")
          : `user_${user.uid.slice(0, 6)}`,
        email: user.email || trimmedEmail,
        avatarURL: "",
        bio: "",
        skills: [],
        rating: 0,
        reviewsCount: 0,
        isOnline: true,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isBanned: false,
        banReason: "",
      });

      nav("/profile");
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Не удалось создать аккаунт.");
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
              <span>Create account</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Регистрация в SkillConnect
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
              Создай аккаунт и сразу получи профиль, доступ к чатам, заказам и
              рабочей панели.
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>После регистрации</div>
              <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
                профиль создастся автоматически
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Создать аккаунт</h2>

        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Имя</div>
            <input
              className="input"
              placeholder="Имя (необязательно)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              placeholder="Минимум 6 символов"
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
              {loading ? "Создаю..." : "Создать аккаунт"}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 16, opacity: 0.82 }}>
          Уже есть аккаунт?{" "}
          <Link to="/login" style={{ textDecoration: "none" }}>
            Войти
          </Link>
        </p>
      </section>
    </div>
  );
}