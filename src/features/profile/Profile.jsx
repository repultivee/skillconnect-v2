import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/init";
import useAuth from "../../hooks/useAuth";
import { listReviewsForUser } from "../../services/reviews.service";

function formatReviewDate(value) {
  if (!value) return "";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

function formatLastSeen(value, isOnline) {
  if (isOnline) return "Онлайн";
  if (!value) return "Не в сети";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "Не в сети";

    const now = new Date();

    const sameDay =
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate();

    const timeText = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (sameDay) {
      return `Был(а) в сети в ${timeText}`;
    }

    const dateText = date.toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return `Был(а) в сети ${dateText}, ${timeText}`;
  } catch {
    return "Не в сети";
  }
}

export default function Profile() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [reviewsError, setReviewsError] = useState("");

  const logout = async () => {
    try {
      if (user?.uid) {
        await updateDoc(doc(db, "users", user.uid), {
          isOnline: false,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("logout presence error:", err);
    }

    await signOut(auth);
    nav("/login");
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (loading) return;

      if (!user?.uid) {
        setProfile(null);
        setReviews([]);
        setLoadingProfile(false);
        return;
      }

      try {
        setLoadingProfile(true);
        setProfileError("");
        setReviewsError("");

        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setProfileError("Профиль не найден в базе.");
          setProfile(null);
          setReviews([]);
          return;
        }

        const profileData = snap.data();
        setProfile(profileData);

        try {
          const loadedReviews = await listReviewsForUser(user.uid);
          setReviews(Array.isArray(loadedReviews) ? loadedReviews : []);
        } catch (reviewsErr) {
          console.error("reviews load error:", reviewsErr);
          setReviews([]);
          setReviewsError("Отзывы временно не загрузились.");
        }
      } catch (err) {
        console.error("profile load error:", err);
        setProfileError("Не удалось загрузить профиль.");
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user, loading]);

  if (loading || loadingProfile) {
    return (
      <div className="card">
        <p>Загрузка профиля...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="card">
        <p>Ты не вошёл.</p>
        <Link to="/login" className="btn">Войти</Link>
      </div>
    );
  }

  if (profileError) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="card">
          <h2 style={{ margin: 0 }}>Профиль</h2>
          <p style={{ color: "tomato", marginTop: 10 }}>{profileError}</p>
        </div>

        <div className="card" style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => window.location.reload()}>
            Обновить
          </button>
          <button className="btn" onClick={logout}>Выйти</button>
        </div>
      </div>
    );
  }

  const avatar = profile?.avatarURL || "";
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const statusText = formatLastSeen(profile?.lastSeen, profile?.isOnline);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            flexShrink: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt="avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{(profile?.displayName || profile?.email || "U")[0].toUpperCase()}</span>
          )}

          <span
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: profile?.isOnline ? "#22c55e" : "rgba(255,255,255,0.25)",
              border: "2px solid #1f2937",
            }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>
            {profile?.displayName || "Без имени"}
          </h2>

          <div style={{ opacity: 0.8, marginTop: 6 }}>
            @{profile?.username || "username"}
          </div>

          <div style={{ opacity: 0.8, marginTop: 6 }}>
            {profile?.email || user.email}
          </div>

          <div style={{ opacity: 0.65, marginTop: 6, fontSize: 13 }}>
            {statusText}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>О себе</h3>
        <p style={{ margin: 0, opacity: 0.9 }}>
          {profile?.bio || "Пока ничего не написал о себе."}
        </p>
      </div>

      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Роль</div>
          <strong>{profile?.role || "client"}</strong>
        </div>

        <div>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Рейтинг</div>
          <strong>{profile?.rating ?? 0}</strong>
        </div>

        <div>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Отзывы</div>
          <strong>{profile?.reviewsCount ?? 0}</strong>
        </div>

        <div>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Статус</div>
          <strong>{statusText}</strong>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Навыки</h3>

        {skills.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {skills.map((skill) => (
              <span
                key={skill}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, opacity: 0.8 }}>Навыки пока не добавлены.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Мои отзывы</h3>

        {reviewsError && (
          <div style={{ marginBottom: 10, color: "#ff9b9b" }}>{reviewsError}</div>
        )}

        {reviews.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.8 }}>Пока отзывов нет.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {reviews.map((review) => (
              <div
                key={review.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>
                    {review.fromUser?.displayName || review.fromUser?.email || "Пользователь"}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    {formatReviewDate(review.createdAt)}
                  </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 15 }}>
                  {"★".repeat(Number(review.rating || 0))}
                  <span style={{ opacity: 0.35 }}>
                    {"★".repeat(5 - Number(review.rating || 0))}
                  </span>
                </div>

                <div style={{ marginTop: 8, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  {review.text || "Без текста"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => nav("/profile/edit")}>
          Редактировать профиль
        </button>

        <button className="btn" onClick={logout}>
          Выйти
        </button>
      </div>
    </div>
  );
}