import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/init";
import useAuth from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function EditProfile() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;

      if (!user?.uid) {
        nav("/login");
        return;
      }

      try {
        setLoading(true);
        setErr("");

        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setErr("Профиль не найден.");
          return;
        }

        const data = snap.data();

        setDisplayName(data.displayName || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setSkills(Array.isArray(data.skills) ? data.skills.join(", ") : "");
      } catch (error) {
        console.error(error);
        setErr("Не удалось загрузить профиль.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, authLoading, nav]);

  const save = async () => {
    if (!user?.uid) return;

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "_");
    const cleanBio = bio.trim();
    const cleanSkills = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!cleanUsername) {
      setErr("Username не может быть пустым.");
      return;
    }

    if (cleanUsername.length < 3) {
      setErr("Username должен быть минимум 3 символа.");
      return;
    }

    try {
      setSaving(true);
      setErr("");

      const ref = doc(db, "users", user.uid);

      await updateDoc(ref, {
        displayName: cleanDisplayName || "User",
        username: cleanUsername,
        bio: cleanBio,
        skills: cleanSkills,
        updatedAt: serverTimestamp(),
      });

      nav("/profile");
    } catch (error) {
      console.error(error);
      setErr("Не удалось сохранить изменения.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="card">Загрузка...</div>;
  }

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
              <span>Edit profile</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Редактирование профиля
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
              Заполни базовую информацию, чтобы профиль выглядел живее и вызывал
              больше доверия.
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Подсказка</div>
              <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
                Добавь имя, username, короткое bio и навыки через запятую
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Данные профиля</h2>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div>
            <div style={{ marginBottom: 6, opacity: 0.8 }}>Имя</div>
            <input
              className="input"
              placeholder="Имя"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.8 }}>Username</div>
            <input
              className="input"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.8 }}>О себе</div>
            <textarea
              className="input"
              placeholder="Расскажи коротко о себе"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              style={{ resize: "vertical" }}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6, opacity: 0.8 }}>Навыки</div>
            <input
              className="input"
              placeholder="react, design, smm"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>

          {err && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,80,80,0.08)",
                border: "1px solid rgba(255,80,80,0.18)",
                color: "#ff8a8a",
              }}
            >
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Сохраняю..." : "Сохранить"}
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => nav("/profile")}
              style={{ opacity: 0.85 }}
            >
              Отмена
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}