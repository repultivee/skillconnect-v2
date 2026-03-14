import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase/init";
import useAuth from "../../hooks/useAuth";

function StatCard({ label, value, subtext }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
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

export default function AdminPanel() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setErr("");

      const usersSnap = await getDocs(query(collection(db, "users")));
      const postsSnap = await getDocs(
        query(collection(db, "posts"), orderBy("createdAt", "desc"))
      );

      const usersData = usersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const postsData = postsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setUsers(usersData);
      setPosts(postsData);
    } catch (error) {
      console.error("admin load error:", error);
      setErr("Не удалось загрузить данные админки.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const name = (u.displayName || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const username = (u.username || "").toLowerCase();
      return name.includes(q) || email.includes(q) || username.includes(q);
    });
  }, [users, search]);

  const stats = useMemo(() => {
    return {
      users: users.length,
      posts: posts.length,
      banned: users.filter((u) => u.isBanned).length,
      admins: users.filter((u) => u.role === "admin").length,
    };
  }, [users, posts]);

  const toggleBanUser = async (userItem) => {
    if (user?.uid === userItem.id) {
      alert("Нельзя банить самого себя.");
      return;
    }

    try {
      setActionLoading(`ban-${userItem.id}`);

      await updateDoc(doc(db, "users", userItem.id), {
        isBanned: !userItem.isBanned,
        banReason: !userItem.isBanned ? "Заблокирован администратором" : "",
        updatedAt: serverTimestamp(),
      });

      await loadData();
    } catch (error) {
      console.error("toggle ban error:", error);
      alert("Не удалось изменить статус пользователя.");
    } finally {
      setActionLoading("");
    }
  };

  const toggleUserRole = async (userItem) => {
    if (user?.uid === userItem.id) {
      alert("Свой admin-статус лучше не трогать.");
      return;
    }

    try {
      setActionLoading(`role-${userItem.id}`);

      await updateDoc(doc(db, "users", userItem.id), {
        role: userItem.role === "admin" ? "client" : "admin",
        updatedAt: serverTimestamp(),
      });

      await loadData();
    } catch (error) {
      console.error("toggle role error:", error);
      alert("Не удалось изменить роль пользователя.");
    } finally {
      setActionLoading("");
    }
  };

  const removePost = async (postId) => {
    const ok = window.confirm("Удалить этот пост?");
    if (!ok) return;

    try {
      setActionLoading(`post-${postId}`);
      await deleteDoc(doc(db, "posts", postId));
      await loadData();
    } catch (error) {
      console.error("delete post error:", error);
      alert("Не удалось удалить пост.");
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return <div className="card">Загрузка админки...</div>;
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
              <span>Administration</span>
            </div>

            <h1
              style={{
                margin: "14px 0 0",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.08,
              }}
            >
              Admin Panel
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
              Управление пользователями, ролями и постами платформы.
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
              <div style={{ opacity: 0.7, fontSize: 13 }}>Текущий админ</div>
              <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.45 }}>
                {user?.email || "admin"}
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
        <StatCard label="Пользователи" value={stats.users} />
        <StatCard label="Посты" value={stats.posts} />
        <StatCard label="Забаненные" value={stats.banned} />
        <StatCard label="Админы" value={stats.admins} />
      </section>

      <section className="card">
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
          <h3 style={{ margin: 0 }}>Пользователи</h3>

          <input
            className="input"
            placeholder="Поиск пользователя..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {filteredUsers.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.8 }}>Ничего не найдено.</p>
          ) : (
            filteredUsers.map((userItem) => (
              <div
                key={userItem.id}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {userItem.displayName || "Без имени"}
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>
                    {userItem.email || "Без email"}
                  </div>
                  <div style={{ opacity: 0.65, marginTop: 4, fontSize: 14 }}>
                    role: {userItem.role || "client"} · @{userItem.username || "username"}
                  </div>
                  <div style={{ opacity: 0.65, marginTop: 4, fontSize: 14 }}>
                    status: {userItem.isBanned ? "banned" : "active"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {user?.uid !== userItem.id && (
                    <>
                      <button
                        className="btn"
                        onClick={() => toggleUserRole(userItem)}
                        disabled={actionLoading === `role-${userItem.id}`}
                        style={{ opacity: 0.92 }}
                      >
                        {actionLoading === `role-${userItem.id}`
                          ? "Обновляю..."
                          : userItem.role === "admin"
                          ? "Снять admin"
                          : "Сделать admin"}
                      </button>

                      <button
                        className="btn"
                        onClick={() => toggleBanUser(userItem)}
                        disabled={actionLoading === `ban-${userItem.id}`}
                      >
                        {actionLoading === `ban-${userItem.id}`
                          ? "Обновляю..."
                          : userItem.isBanned
                          ? "Разбанить"
                          : "Забанить"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Посты</h3>

        <div style={{ display: "grid", gap: 10 }}>
          {posts.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.8 }}>Постов пока нет.</p>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {post.title || "Без названия"}
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>
                    {post.description?.slice(0, 140) || "Без описания"}
                  </div>
                  <div style={{ opacity: 0.6, marginTop: 4, fontSize: 14 }}>
                    authorId: {post.authorId || "unknown"} · status: {post.status || "open"}
                  </div>
                </div>

                <button
                  className="btn"
                  onClick={() => removePost(post.id)}
                  disabled={actionLoading === `post-${post.id}`}
                >
                  {actionLoading === `post-${post.id}` ? "Удаляю..." : "Удалить"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}