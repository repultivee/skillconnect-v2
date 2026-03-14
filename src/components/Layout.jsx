import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import useAuth from "../hooks/useAuth";
import { auth, db } from "../firebase/init";
import { useLang } from "../contexts/lang";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

export default function Layout({ children }) {
  const nav = useNavigate();
  const location = useLocation();
  const authState = useAuth();
  const user = authState?.user ?? null;
  const loading = authState?.loading ?? false;

  const langState = useLang();
  const lang = langState?.lang ?? "ru";
  const setLang = langState?.setLang ?? (() => {});
  const t = langState?.t ?? ((key) => key);

  const [q, setQ] = useState("");
  const [unreadChats, setUnreadChats] = useState(0);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setUserRole("");
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (!snap.exists()) {
          setUserRole("");
          return;
        }

        const data = snap.data();
        setUserRole(String(data?.role || "").trim().toLowerCase());
      },
      (error) => {
        console.error("role snapshot error:", error);
        setUserRole("");
      }
    );

    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadChats(0);
      return;
    }

    const qy = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid)
    );

    const unsub = onSnapshot(qy, (snap) => {
      let total = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        total += Number(data?.unreadCounts?.[user.uid] || 0);
      });

      setUnreadChats(total);
    });

    return () => unsub();
  }, [user?.uid]);

  const labels = useMemo(() => {
    return {
      search: t("searchPlaceholder"),
      home: t("home"),
      create: t("create"),
      chats: t("chats"),
      profile: t("account"),
      login: t("login"),
      register: t("register"),
      logout: t("logout"),
      admin: "Admin",
    };
  }, [t]);

  const logout = async () => {
    await signOut(auth);
    nav("/login");
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    const s = q.trim();
    nav(s ? `/?q=${encodeURIComponent(s)}` : "/");
  };

  const showCreate = Boolean(user);
  const showAdmin = Boolean(user && userRole === "admin");
  const showChats = Boolean(user);
  const showUserMenu = Boolean(!loading && user);
  const showAuthMenu = Boolean(!loading && !user);

  const avatarText = (user?.email || user?.displayName || "U")[0].toUpperCase();
  const userText = user?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <div className="sc-page">
      <header className="sc-header">
        <div className="container sc-header-inner">
          <div className="sc-left">
            <Link to="/" className="sc-brand">
              <span className="sc-brand-dot" />
              <span className="sc-brand-text">SkillConnect</span>
            </Link>

            <nav className="sc-nav">
              <NavLink
                to="/"
                className={({ isActive }) => cx("sc-navlink", isActive && "is-active")}
              >
                {labels.home}
              </NavLink>

              {showCreate && (
                <NavLink
                  to="/create"
                  className={({ isActive }) => cx("sc-navlink", isActive && "is-active")}
                >
                  {labels.create}
                </NavLink>
              )}

              {showAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => cx("sc-navlink", isActive && "is-active")}
                >
                  {labels.admin}
                </NavLink>
              )}
            </nav>
          </div>
          <form className="sc-search" onSubmit={onSearchSubmit}>
            <span className="sc-search-ico">⌕</span>
            <input
              className="sc-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.search}
            />
            <button className="sc-search-btn" type="submit">
              Enter
            </button>
          </form>

          <div className="sc-right">
            <button
              className="sc-pill"
              type="button"
              onClick={() => setLang(lang === "ru" ? "en" : "ru")}
              title="Language"
            >
              <span className="sc-pill-text">{lang.toUpperCase()}</span>
            </button>

            {showChats && (
              <button
                className="sc-iconbtn"
                type="button"
                onClick={() => nav("/chats")}
                title={labels.chats}
                style={{ position: "relative" }}
              >
                💬
                {unreadChats > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      borderRadius: 999,
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      border: "2px solid #0b0f19",
                    }}
                  >
                    {unreadChats > 99 ? "99+" : unreadChats}
                  </span>
                )}
              </button>
            )}

            {showUserMenu && (
              <div className="sc-user">
                <button
                  type="button"
                  className="sc-userbtn"
                  onClick={() => nav("/profile")}
                  title={labels.profile}
                >
                  <span className="sc-avatar">{avatarText}</span>

                  <span className="sc-usertext">
                    <span className="sc-useremail">{userText}</span>
                  </span>
                </button>

                <button className="sc-ghostbtn" type="button" onClick={logout}>
                  {labels.logout}
                </button>
              </div>
            )}

            {showAuthMenu && (
              <div className="sc-auth">
                <Link className="sc-ghostlink" to="/login">
                  {labels.login}
                </Link>
                <Link className="sc-solidlink" to="/register">
                  {labels.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        className={cx(
          "sc-main",
          location.pathname.startsWith("/chats") ? "container--wide" : "container"
        )}
      >
        {children}
      </main>

      <footer className="sc-footer">
        <div className="container sc-footer-inner">© SkillConnect 2026</div>
      </footer>
    </div>
  );
}