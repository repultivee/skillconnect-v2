import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../../firebase/init";
import { Link } from "react-router-dom";

function formatTicketDate(value) {
  if (!value) return "";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  } catch {
    return "";
  }
}

function statusLabel(status) {
  switch (status) {
    case "closed":
      return "Закрыт";
    case "in_progress":
      return "В работе";
    case "open":
    default:
      return "Открыт";
  }
}

export default function Support() {
  const [user, setUser] = useState(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadTickets = async () => {
      if (!user?.uid) {
        setTickets([]);
        setFetching(false);
        return;
      }

      try {
        setFetching(true);

        const q = query(
          collection(db, "supportTickets"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setFetching(false);
      }
    };

    loadTickets();
  }, [user?.uid]);

  const reloadTickets = async () => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "supportTickets"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);
    setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!user) {
      setErr("Нужно войти в аккаунт.");
      return;
    }

    if (!cleanSubject || !cleanMessage) {
      setErr("Заполни тему и описание.");
      return;
    }

    if (cleanSubject.length < 4) {
      setErr("Тема слишком короткая.");
      return;
    }

    if (cleanMessage.length < 10) {
      setErr("Опиши проблему чуть подробнее.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "supportTickets"), {
        userId: user.uid,
        email: user.email || "",
        subject: cleanSubject,
        message: cleanMessage,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSubject("");
      setMessage("");
      setOk("Тикет отправлен.");
      await reloadTickets();
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Не удалось отправить тикет.");
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
              <span>Support center</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Поддержка
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
              Опиши проблему, и запрос сохранится в системе. Если у тебя уже
              настроен чат поддержки, удобнее писать туда.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <Link to="/chats" className="btn" style={{ textDecoration: "none" }}>
                Открыть чаты
              </Link>

              <Link to="/" className="btn" style={{ textDecoration: "none", opacity: 0.9 }}>
                На главную
              </Link>
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Тикетов создано</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
                {tickets.length}
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Аккаунт</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>
                {user?.email || "Не авторизован"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ maxWidth: 920 }}>
        <h2 style={{ marginTop: 0 }}>Создать тикет</h2>
        <p style={{ opacity: 0.8, marginTop: 8 }}>
          Чем точнее ты опишешь проблему, тем быстрее будет понятен контекст.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Тема</div>
            <input
              className="input"
              placeholder="Например: не открывается чат"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ opacity: 0.82, fontSize: 14 }}>Описание проблемы</div>
            <textarea
              className="input"
              placeholder="Опиши, что именно произошло, когда это началось и что ты уже пробовал сделать"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ resize: "vertical" }}
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

          {ok && (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.18)",
                color: "#9fe6be",
              }}
            >
              {ok}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" disabled={loading}>
              {loading ? "Отправляю..." : "Отправить"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Мои тикеты</h3>

        {fetching ? (
          <div style={{ opacity: 0.8 }}>Загрузка...</div>
        ) : tickets.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              opacity: 0.82,
            }}
          >
            Пока нет тикетов.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: 14,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{ticket.subject}</strong>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 12,
                      opacity: 0.85,
                    }}
                  >
                    {statusLabel(ticket.status)}
                  </span>
                </div>

                <div style={{ marginTop: 10, opacity: 0.88, lineHeight: 1.55 }}>
                  {ticket.message}
                </div>

                <div style={{ marginTop: 10, opacity: 0.58, fontSize: 12 }}>
                  {formatTicketDate(ticket.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}