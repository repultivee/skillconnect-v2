import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase/init";
import { useLang } from "../contexts/lang";
import { useCurrency } from "../contexts/currency";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export default function Header() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, loading } = useAuth();

  const { lang, setLang, t } = useLang();
  const { currency, setCurrency } = useCurrency();

  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    const sp = new URLSearchParams(loc.search);
    setQ(sp.get("q") || "");
  }, [loc.search]);

  useEffect(() => {
    const onDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
  }, []);

  // realtime unread chats
  useEffect(() => {
    if (!user?.uid) return;

    const qy = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid)
    );

    const unsub = onSnapshot(qy, (snap) => {
      let total = 0;

      snap.docs.forEach((doc) => {
        const data = doc.data();
        const count = data?.unreadCounts?.[user.uid] || 0;
        total += count;
      });

      setUnreadChats(total);
    });

    return () => unsub();
  }, [user?.uid]);

  const submitSearch = (e) => {
    e.preventDefault();
    const query = q.trim();
    nav(query ? `/?q=${encodeURIComponent(query)}` : `/`);
  };

  const toggleLang = () => setLang(lang === "ru" ? "en" : "ru");
  const toggleCurrency = () => setCurrency(currency === "USD" ? "RUB" : "USD");

  const logout = async () => {
    await signOut(auth);
    setMenuOpen(false);
    nav("/login");
  };

  return (
    <header style={styles.header}>
      <div className="container" style={styles.inner}>
        {/* Left */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 240 }}>
          <Link to="/" style={styles.logo}>
            SkillConnect
          </Link>

          <nav style={styles.nav}>
            <Link to="/">{t("home")}</Link>
            {user && <Link to="/create">{t("create")}</Link>}
            {user && <Link to="/dashboard">Dashboard</Link>}
          </nav>
        </div>

        {/* Search */}
        <form onSubmit={submitSearch} style={styles.searchForm}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            style={{ flex: 1 }}
          />
          <button className="btn" type="submit" style={{ minWidth: 44 }}>
            🔎
          </button>
        </form>

        {/* Right */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", minWidth: 240 }}>
          <button className="btn" onClick={toggleLang} style={{ minWidth: 44 }}>
            🌐
          </button>

          <button className="btn" onClick={toggleCurrency} style={{ minWidth: 44 }}>
            💱
          </button>

          {/* Chats */}
          <div style={{ position: "relative" }}>
            <Link className="btn" to="/chats" style={{ minWidth: 44 }}>
              💬
            </Link>

            {unreadChats > 0 && (
              <span style={styles.badge}>
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            )}
          </div>

          {/* Account */}
          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => setMenuOpen((s) => !s)} style={{ minWidth: 44 }}>
              👤
            </button>

            {menuOpen && (
              <div className="card" style={styles.menu}>
                {loading ? null : !user ? (
                  <>
                    <Link className="btn" to="/login" onClick={() => setMenuOpen(false)}>
                      {t("login")}
                    </Link>
                    <Link className="btn" to="/register" onClick={() => setMenuOpen(false)}>
                      {t("register")}
                    </Link>
                  </>
                ) : (
                  <>
                    <div style={{ opacity: 0.85, fontSize: 13 }}>{user.email}</div>
                    <Link className="btn" to="/dashboard" onClick={() => setMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <button className="btn" onClick={logout}>
                      {t("logout")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    position: "sticky",
    top: 0,
    backdropFilter: "blur(10px)",
    zIndex: 10,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 12,
    gap: 14,
  },
  logo: {
    textDecoration: "none",
    color: "inherit",
    fontWeight: 900,
  },
  nav: { display: "flex", gap: 12, opacity: 0.9 },
  searchForm: { flex: 1, display: "flex", gap: 10, maxWidth: 520 },
  menu: {
    position: "absolute",
    right: 0,
    top: "calc(100% + 10px)",
    width: 240,
    padding: 10,
    display: "grid",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    background: "#ef4444",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 999,
    border: "2px solid #0b0f19",
  },
};