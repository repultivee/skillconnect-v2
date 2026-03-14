import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { createPost } from "../../services/posts.service";

const CATEGORIES = ["Design", "Development", "SMM", "Copywriting", "Other"];

export default function CreatePost() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Design");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;

  const budgetPreview = useMemo(() => {
    if (!budget) return "Договорная";
    const num = Number(budget);
    if (Number.isNaN(num)) return budget;
    return `${num.toLocaleString()} AMD`;
  }, [budget]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanBudget = budget.trim();

    if (!user) {
      setErr("Сначала войди в аккаунт.");
      return;
    }

    if (!cleanTitle) {
      setErr("Введите заголовок.");
      return;
    }

    if (cleanTitle.length < 6) {
      setErr("Заголовок должен быть хотя бы 6 символов.");
      return;
    }

    if (!cleanDescription) {
      setErr("Введите описание.");
      return;
    }

    if (cleanDescription.length < 20) {
      setErr("Описание должно быть хотя бы 20 символов.");
      return;
    }

    try {
      setLoading(true);

      const id = await createPost({
        title: cleanTitle,
        description: cleanDescription,
        category,
        budget: cleanBudget,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split("@")[0] || "User",
        authorEmail: user.email || "",
      });

      nav(`/post/${id}`);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Ошибка создания поста");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
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
              "radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 35%), radial-gradient(circle at bottom right, rgba(16,185,129,0.14), transparent 30%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
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
              <span>New project request</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Создай пост
              <br />
              и найди исполнителя
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
              Чем понятнее и конкретнее ты опишешь задачу, тем выше шанс
              получить нормальные отклики от подходящих специалистов.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 14,
                }}
              >
                Заголовок: <b>{titleLength}</b>
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 14,
                }}
              >
                Описание: <b>{descriptionLength}</b>
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 14,
                }}
              >
                Бюджет: <b>{budgetPreview}</b>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ opacity: 0.7, fontSize: 13 }}>Совет</div>
              <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
                Добавь понятный заголовок и коротко объясни, что именно нужно
                сделать.
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ opacity: 0.7, fontSize: 13 }}>Категория</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>{category}</div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ opacity: 0.7, fontSize: 13 }}>Статус</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>
                Будет опубликован как open
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 920 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Форма публикации</h2>
            <p style={{ margin: "8px 0 0", opacity: 0.78 }}>
              Заполни поля ниже и опубликуй задачу.
            </p>
          </div>

          <Link
            to="/"
            className="btn"
            style={{ textDecoration: "none", opacity: 0.9 }}
          >
            Назад
          </Link>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Заголовок</div>
            <input
              className="input"
              placeholder="Например: Нужен дизайнер для логотипа"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Описание</div>
            <textarea
              className="input"
              placeholder="Опиши задачу подробнее: что нужно сделать, в какие сроки, какой результат ожидаешь"
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ opacity: 0.82, fontSize: 14 }}>Категория</div>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ opacity: 0.82, fontSize: 14 }}>Бюджет</div>
              <input
                className="input"
                placeholder="Например: 25000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
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
              {loading ? "Создаю..." : "Создать пост"}
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => nav("/")}
              style={{ opacity: 0.85 }}
            >
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}