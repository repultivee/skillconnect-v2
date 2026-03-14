import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { getPost } from "../../services/posts.service";
import { createPendingChat } from "../../services/chats.service";

function formatBudget(value) {
  if (value === null || value === undefined || value === "") return "Договорная";
  const num = Number(value);
  if (Number.isNaN(num)) return `${value}`;
  return `${num.toLocaleString()} AMD`;
}

function statusMeta(status) {
  switch (status) {
    case "in_progress":
      return { label: "В работе", tone: "rgba(59,130,246,0.14)" };
    case "done":
      return { label: "Завершён", tone: "rgba(16,185,129,0.14)" };
    case "closed":
      return { label: "Закрыт", tone: "rgba(244,63,94,0.14)" };
    case "open":
    default:
      return { label: "Открыт", tone: "rgba(255,255,255,0.05)" };
  }
}

export default function Post() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setErr("");
        setLoading(true);
        const data = await getPost(id);
        setPost(data);
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Ошибка загрузки поста");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const isOwner = useMemo(() => {
    if (!user || !post) return false;
    return post.authorId === user.uid;
  }, [user, post]);

  const isOpen = (post?.status || "open") === "open";
  const meta = statusMeta(post?.status || "open");
  const descLength = String(text || "").trim().length;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!user) {
      setErr("Сначала войди, чтобы откликнуться.");
      return;
    }

    if (!post) return;

    if (isOwner) {
      setErr("Нельзя откликаться на свой пост 🙂");
      return;
    }

    if (!isOpen) {
      setErr("Этот заказ уже недоступен для новых откликов.");
      return;
    }

    if (!text.trim()) {
      setErr("Напиши сообщение для заказчика.");
      return;
    }

    if (text.trim().length < 10) {
      setErr("Сообщение слишком короткое.");
      return;
    }

    try {
      setSending(true);

      const chatId = await createPendingChat({
        postId: post.id,
        postTitle: post.title,
        customerId: post.authorId,
        executorId: user.uid,
        starterText: text.trim(),
        senderId: user.uid,
        senderEmail: user.email || "",
        senderName: user.displayName || user.email?.split("@")[0] || "User",
      });

      nav(`/chats?id=${chatId}`);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Не удалось создать чат-заявку");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="card">Загрузка поста...</div>;
  }

  if (err && !post) {
    return (
      <div
        className="card"
        style={{
          border: "1px solid rgba(255,99,99,0.25)",
          color: "#ff9b9b",
        }}
      >
        {err}
      </div>
    );
  }

  if (!post) {
    return <div className="card">Пост не найден.</div>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.75fr)",
        gap: 14,
        alignItems: "start",
      }}
    >
      <section style={{ display: "grid", gap: 14 }}>
        <div
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
                "radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 30%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              padding: 22,
              display: "grid",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: meta.tone,
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  <span>●</span>
                  <span>{meta.label}</span>
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(26px, 4vw, 38px)",
                    lineHeight: 1.08,
                    wordBreak: "break-word",
                  }}
                >
                  {post.title || "Без названия"}
                </h1>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      padding: "7px 11px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 13,
                    }}
                  >
                    {post.category || "General"}
                  </span>

                  <span
                    style={{
                      padding: "7px 11px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 13,
                    }}
                  >
                    ID: {post.id?.slice?.(0, 8) || "—"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.18)",
                  minWidth: 140,
                }}
              >
                <div style={{ opacity: 0.72, fontSize: 12 }}>Бюджет</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>
                  {formatBudget(post.budget)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ opacity: 0.74, fontSize: 13 }}>Описание заказа</div>

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.65,
                  fontSize: 15,
                  opacity: 0.94,
                }}
              >
                {post.description || "Без описания"}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0 }}>Отклик на заказ</h3>

            <div
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                background: isOpen
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(244,63,94,0.10)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 13,
              }}
            >
              {isOpen ? "Принимает отклики" : "Отклики закрыты"}
            </div>
          </div>

          {isOwner ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                opacity: 0.9,
                lineHeight: 1.55,
              }}
            >
              Это твой пост — здесь исполнители будут писать тебе заявки и
              открывать чат по заказу.
            </div>
          ) : !isOpen ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                opacity: 0.9,
                lineHeight: 1.55,
              }}
            >
              Этот заказ уже взят или закрыт. Новые отклики сейчас недоступны.
            </div>
          ) : (
            <>
              {!user && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 14,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    opacity: 0.9,
                  }}
                >
                  Чтобы откликнуться, нужно <Link to="/login">войти</Link>.
                </div>
              )}

              <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ opacity: 0.82, fontSize: 14 }}>
                    Сообщение заказчику
                  </div>

                  <textarea
                    className="input"
                    rows={6}
                    placeholder="Коротко расскажи о себе, опыте, сроках, цене и почему именно ты подходишь..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={!user || sending}
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ opacity: 0.68, fontSize: 13 }}>
                    Символов: {descLength}
                  </div>

                  <button className="btn" disabled={!user || sending}>
                    {sending ? "Создаю чат..." : "Откликнуться и открыть чат"}
                  </button>
                </div>
              </form>
            </>
          )}

          {err && post && (
            <div
              style={{
                marginTop: 12,
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
        </div>
      </section>

      <aside style={{ display: "grid", gap: 14 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Информация</h3>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Автор</div>
              <div style={{ fontWeight: 700 }}>
                {post.authorId ? (
                  <Link to={`/user/${post.authorId}`}>
                    {post.authorName || "User"}
                  </Link>
                ) : (
                  post.authorName || "User"
                )}
              </div>
            </div>

            <div>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Категория</div>
              <div style={{ fontWeight: 700 }}>{post.category || "Other"}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Статус</div>
              <div style={{ fontWeight: 700 }}>{meta.label}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, marginBottom: 4 }}>Бюджет</div>
              <div style={{ fontWeight: 700 }}>{formatBudget(post.budget)}</div>
            </div>

            {post.executorId && (
              <div>
                <div style={{ opacity: 0.7, marginBottom: 4 }}>Исполнитель</div>
                <div style={{ fontWeight: 700 }}>Уже выбран</div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Быстрые действия</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <Link to="/" className="btn" style={{ textDecoration: "none" }}>
              Назад к ленте
            </Link>

            {post.authorId && (
              <Link
                to={`/user/${post.authorId}`}
                className="btn"
                style={{ textDecoration: "none", opacity: 0.9 }}
              >
                Открыть профиль автора
              </Link>
            )}

            {user && !isOwner && (
              <button
                className="btn"
                type="button"
                onClick={() =>
                  document
                    .querySelector('textarea')
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                style={{ opacity: 0.9 }}
              >
                Перейти к отклику
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}