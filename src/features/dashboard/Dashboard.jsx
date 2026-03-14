import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

import useAuth from "../../hooks/useAuth";
import { auth } from "../../firebase/init";

import { listPosts } from "../../services/posts.service";
import {
  listPendingApplicationsByOwner,
  listAcceptedApplicationsByOwner,
  listAcceptedApplicationsByApplicant,
} from "../../services/applications.service";

import {
  acceptApplication,
  findChatIdByDealMembers,
} from "../../services/deals.service";

function formatBudget(value) {
  if (value === null || value === undefined || value === "") return "Договорная";
  const num = Number(value);
  if (Number.isNaN(num)) return `${value}`;
  return `${num.toLocaleString()} AMD`;
}

function EmptyState({ title, text, action }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ opacity: 0.78 }}>{text}</div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [myPosts, setMyPosts] = useState([]);
  const [pendingApps, setPendingApps] = useState([]);
  const [myAcceptedAsWorker, setMyAcceptedAsWorker] = useState([]);
  const [myAcceptedAsOwner, setMyAcceptedAsOwner] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const stats = useMemo(() => {
    const totalBudget = myPosts.reduce((sum, p) => {
      const value = Number(p?.budget || 0);
      return Number.isNaN(value) ? sum : sum + value;
    }, 0);

    return {
      posts: myPosts.length,
      pending: pendingApps.length,
      acceptedOwner: myAcceptedAsOwner.length,
      acceptedWorker: myAcceptedAsWorker.length,
      totalBudget,
    };
  }, [myPosts, pendingApps, myAcceptedAsOwner, myAcceptedAsWorker]);

  const load = async () => {
    if (!user?.uid) return;

    try {
      setErr("");
      setLoading(true);

      const posts = await listPosts();
      setMyPosts((posts || []).filter((p) => p.authorId === user.uid));

      const pending = await listPendingApplicationsByOwner(user.uid);
      setPendingApps(Array.isArray(pending) ? pending : []);

      const acceptedOwner = await listAcceptedApplicationsByOwner(user.uid);
      setMyAcceptedAsOwner(Array.isArray(acceptedOwner) ? acceptedOwner : []);

      const acceptedWorker = await listAcceptedApplicationsByApplicant(user.uid);
      setMyAcceptedAsWorker(Array.isArray(acceptedWorker) ? acceptedWorker : []);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    load();
  }, [user?.uid, authLoading]);

  const logout = async () => {
    await signOut(auth);
    nav("/login");
  };

  const onAccept = async (a) => {
    if (!user?.uid) return;

    if (a.applicantId === user.uid) {
      setErr("Нельзя принять отклик от самого себя 🙂");
      return;
    }

    try {
      setErr("");

      const res = await acceptApplication({
        applicationId: a.id,
        postId: a.postId,
        clientId: user.uid,
        workerId: a.applicantId,
      });

      await load();

      if (res?.chatId) {
        nav(`/chat/${res.chatId}`);
      }
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Не удалось принять отклик");
    }
  };

  const openChatFromApplication = async (a) => {
    try {
      setErr("");

      const directChatId = a.chatId || a.dealChatId;
      if (directChatId) {
        nav(`/chat/${directChatId}`);
        return;
      }

      const clientId = a.postOwnerId;
      const workerId = a.applicantId;

      const chatId = await findChatIdByDealMembers({
        postId: a.postId,
        clientId,
        workerId,
      });

      if (!chatId) {
        setErr("Чат не найден: похоже, сделка не создалась или удалена");
        return;
      }

      nav(`/chat/${chatId}`);
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Не удалось открыть чат");
    }
  };

  if (authLoading || loading) {
    return <div className="card">Загрузка dashboard...</div>;
  }

  if (!user) {
    return (
      <div className="card">
        <p>Ты не вошёл.</p>
        <Link to="/login" className="btn">
          Войти
        </Link>
      </div>
    );
  }

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
              "radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 35%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 30%)",
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
              <span>Workspace overview</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Dashboard
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
              Здесь собраны твои посты, новые отклики и активные сделки как
              клиента и как специалиста.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <Link to="/create" className="btn" style={{ textDecoration: "none" }}>
                Создать пост
              </Link>

              <Link to="/chats" className="btn" style={{ textDecoration: "none", opacity: 0.9 }}>
                Открыть чаты
              </Link>

              <button className="btn" onClick={logout} style={{ opacity: 0.9 }}>
                Выйти
              </button>
            </div>
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Аккаунт</div>
              <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
                {user.email}
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Новых откликов</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
                {stats.pending}
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Мои посты</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
                {stats.posts}
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div
          className="card"
          style={{
            border: "1px solid rgba(255,99,99,0.25)",
            color: "#ff9b9b",
          }}
        >
          {err}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Мои посты</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {stats.posts}
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Pending отклики</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {stats.pending}
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Сделки как клиент</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {stats.acceptedOwner}
          </div>
        </div>

        <div className="card">
          <div style={{ opacity: 0.7, fontSize: 13 }}>Сделки как специалист</div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {stats.acceptedWorker}
          </div>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>🧑‍💼 Я клиент</h3>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <h4 style={{ margin: 0 }}>Мои посты</h4>
              <div style={{ opacity: 0.65, fontSize: 13 }}>
                Суммарный бюджет: {stats.totalBudget.toLocaleString()} AMD
              </div>
            </div>

            {myPosts.length === 0 ? (
              <EmptyState
                title="Постов пока нет"
                text="Создай первый заказ, чтобы начать искать исполнителей."
                action={
                  <Link to="/create" className="btn" style={{ textDecoration: "none" }}>
                    Создать пост
                  </Link>
                }
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 12,
                }}
              >
                {myPosts.map((p) => (
                  <Link
                    key={p.id}
                    to={`/post/${p.id}`}
                    className="card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{p.title || "Без названия"}</div>
                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 12,
                          background: "rgba(16,185,129,0.08)",
                          border: "1px solid rgba(16,185,129,0.16)",
                          fontWeight: 700,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatBudget(p.budget)}
                      </div>
                    </div>

                    <div style={{ opacity: 0.75, marginTop: 8 }}>
                      {p.category || "Other"} · <b>{p.status || "open"}</b>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h4 style={{ marginTop: 0 }}>Отклики на мои посты</h4>

            {pendingApps.length === 0 ? (
              <EmptyState
                title="Новых откликов нет"
                text="Когда исполнители начнут откликаться, они появятся здесь."
              />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {pendingApps.map((a) => (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ opacity: 0.75, fontSize: 13 }}>Отклик от</div>
                        <div style={{ fontWeight: 700 }}>
                          {a.applicantEmail || a.applicantId}
                        </div>
                      </div>

                      <button className="btn" onClick={() => onAccept(a)}>
                        Принять
                      </button>
                    </div>

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                        opacity: 0.9,
                      }}
                    >
                      {a.text || "Без текста"}
                    </div>

                    <div style={{ opacity: 0.6, fontSize: 12 }}>
                      postId: {a.postId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h4 style={{ marginTop: 0 }}>Мои активные сделки</h4>

            {myAcceptedAsOwner.length === 0 ? (
              <EmptyState
                title="Активных сделок пока нет"
                text="После принятия отклика активные сделки появятся здесь."
              />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {myAcceptedAsOwner.map((a) => (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ opacity: 0.75, fontSize: 13 }}>Исполнитель</div>
                      <div style={{ fontWeight: 700 }}>
                        {a.applicantEmail || a.applicantId}
                      </div>
                      <div style={{ opacity: 0.6, fontSize: 12, marginTop: 6 }}>
                        postId: {a.postId}
                      </div>
                    </div>

                    <button className="btn" onClick={() => openChatFromApplication(a)}>
                      Открыть чат
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>🧑‍🔧 Я специалист</h3>

        <div
          style={{
            padding: 16,
            borderRadius: 18,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginTop: 12,
          }}
        >
          <h4 style={{ marginTop: 0 }}>Мои активные сделки</h4>

          {myAcceptedAsWorker.length === 0 ? (
            <EmptyState
              title="Активных сделок нет"
              text="Когда твой отклик примут, здесь появится активный чат с клиентом."
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {myAcceptedAsWorker.map((a) => (
                <div
                  key={a.id}
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ opacity: 0.75, fontSize: 13 }}>Клиент</div>
                    <div style={{ fontWeight: 700 }}>
                      {a.postOwnerEmail || a.postOwnerId || "Клиент"}
                    </div>
                    <div style={{ opacity: 0.6, fontSize: 12, marginTop: 6 }}>
                      postId: {a.postId}
                    </div>
                  </div>

                  <button className="btn" onClick={() => openChatFromApplication(a)}>
                    Открыть чат
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
} 