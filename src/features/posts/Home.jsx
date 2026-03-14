import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listPosts } from "../../services/posts.service";
import useAuth from "../../hooks/useAuth";

function formatBudget(value) {
  if (value === null || value === undefined || value === "") return "Договорная";
  const num = Number(value);
  if (Number.isNaN(num)) return `${value}`;
  return `${num.toLocaleString()} AMD`;
}

const DEMO_POSTS = [
  {
    id: "demo-1",
    title: "Нужен UX/UI дизайнер для лендинга",
    description:
      "Ищу дизайнера для современного лендинга IT-сервиса. Нужен clean стиль, mobile-first и аккуратная подача блоков.",
    category: "Design",
    budget: 120000,
    authorName: "Arman Studio",
    demo: true,
    proposals: 6,
  },
  {
    id: "demo-2",
    title: "React разработчик для доработки платформы",
    description:
      "Нужно доработать личный кабинет, интегрировать Firestore и улучшить UI нескольких страниц. Желательно опыт с Firebase.",
    category: "Development",
    budget: 180000,
    authorName: "Narek Dev",
    demo: true,
    proposals: 4,
  },
  {
    id: "demo-3",
    title: "SMM специалист для Instagram-магазина",
    description:
      "Нужен человек на контент-план, визуал и базовую стратегию продвижения бренда одежды. Работа на 2–3 недели.",
    category: "SMM",
    budget: 90000,
    authorName: "Mila Brand",
    demo: true,
    proposals: 9,
  },
];

function StatCard({ label, value, subtext }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ opacity: 0.7, fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{value}</div>
      {subtext ? (
        <div style={{ marginTop: 6, opacity: 0.68, fontSize: 13 }}>{subtext}</div>
      ) : null}
    </div>
  );
}

function PostCard({ post, isDemo = false }) {
  const description = String(post.description || "");
  const shortText = description.slice(0, 150) + (description.length > 150 ? "..." : "");

  const cardContent = (
    <div
      className="card"
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 20,
        minHeight: 240,
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
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 12,
              opacity: 0.85,
              marginBottom: 10,
            }}
          >
            {post.category || "General"}
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              lineHeight: 1.25,
              wordBreak: "break-word",
            }}
          >
            {post.title || "Без названия"}
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "8px 10px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.16)",
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          {formatBudget(post.budget)}
        </div>
      </div>

      <div
        style={{
          opacity: 0.78,
          marginTop: 12,
          lineHeight: 1.55,
          minHeight: 72,
        }}
      >
        {shortText}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ opacity: 0.65, fontSize: 13 }}>
          Автор: {post.authorName || "User"}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {typeof post.proposals === "number" && (
            <div
              style={{
                fontSize: 12,
                opacity: 0.7,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {post.proposals} откликов
            </div>
          )}

          <div
            style={{
              fontSize: 13,
              opacity: 0.72,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {isDemo ? "Демо" : "Открыть →"}
          </div>
        </div>
      </div>
    </div>
  );

  if (isDemo) {
    return <div style={{ opacity: 0.92 }}>{cardContent}</div>;
  }

  return (
    <Link to={`/post/${post.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      {cardContent}
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setErr("");
        setLoading(true);
        const data = await listPosts();
        setPosts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const searchQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("q") || "").trim().toLowerCase();
  }, [location.search]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery) return posts;

    return posts.filter((p) => {
      const title = String(p.title || "").toLowerCase();
      const description = String(p.description || "").toLowerCase();
      const category = String(p.category || "").toLowerCase();
      const authorName = String(p.authorName || "").toLowerCase();

      return (
        title.includes(searchQuery) ||
        description.includes(searchQuery) ||
        category.includes(searchQuery) ||
        authorName.includes(searchQuery)
      );
    });
  }, [posts, searchQuery]);

  const totalBudget = useMemo(() => {
    return filteredPosts.reduce((sum, p) => {
      const value = Number(p.budget || 0);
      return Number.isNaN(value) ? sum : sum + value;
    }, 0);
  }, [filteredPosts]);

  const displayedDemoPosts = !loading && !err && filteredPosts.length === 0 && !searchQuery;

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
            gridTemplateColumns: "1.6fr 1fr",
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
              <span>●</span>
              <span>Marketplace for clients & professionals</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 46px)",
                lineHeight: 1.02,
              }}
            >
              Найди специалиста
              <br />
              или возьми новый заказ
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
              SkillConnect — площадка, где клиенты публикуют задачи, а исполнители
              откликаются, договариваются и работают напрямую.
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              {user ? (
                <Link
                  to="/create"
                  className="btn"
                  style={{ textDecoration: "none" }}
                >
                  Создать пост
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="btn"
                  style={{ textDecoration: "none" }}
                >
                  Начать сейчас
                </Link>
              )}

              <Link
                to="/chats"
                className="btn"
                style={{
                  textDecoration: "none",
                  opacity: user ? 1 : 0.7,
                  pointerEvents: user ? "auto" : "none",
                }}
              >
                Открыть чаты
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            <StatCard
              label="Открытых задач"
              value={filteredPosts.length}
              subtext="Актуальные заказы в ленте"
            />
            <StatCard
              label="Суммарный бюджет"
              value={`${totalBudget.toLocaleString()} AMD`}
              subtext="По текущим результатам"
            />
            <StatCard
              label="Статус ленты"
              value={displayedDemoPosts ? "Demo mode" : "Live"}
              subtext={
                displayedDemoPosts
                  ? "Показываются демо-карточки для вида"
                  : "Показываются реальные посты"
              }
            />
          </div>
        </div>
      </section>

      {searchQuery && (
        <div className="card">
          <div style={{ fontWeight: 700 }}>Результаты поиска</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            По запросу: <b>{searchQuery}</b> найдено {filteredPosts.length}
          </div>
        </div>
      )}

      {loading && <div className="card">Загрузка постов...</div>}

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

      {!loading && !err && filteredPosts.length === 0 && !searchQuery && (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Пока нет реальных постов</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Ниже показываются демо-карточки, чтобы платформа выглядела живой.
            Как только создашь пост — они исчезнут.
          </p>

          {user && (
            <div>
              <Link
                to="/create"
                className="btn"
                style={{ textDecoration: "none" }}
              >
                Создать первый пост
              </Link>
            </div>
          )}
        </div>
      )}

      {!loading && !err && filteredPosts.length === 0 && searchQuery && (
        <div
          className="card"
          style={{
            display: "grid",
            gap: 10,
            justifyItems: "start",
          }}
        >
          <h3 style={{ margin: 0 }}>Ничего не найдено</h3>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Попробуй другой запрос или очисти поиск.
          </p>
        </div>
      )}

      {!loading && !err && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {filteredPosts.length > 0
            ? filteredPosts.map((p) => <PostCard key={p.id} post={p} />)
            : !searchQuery &&
              DEMO_POSTS.map((p) => <PostCard key={p.id} post={p} isDemo />)}
        </div>
      )}
    </div>
  );
}