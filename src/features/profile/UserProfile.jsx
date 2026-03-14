import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db } from "../../firebase/init";
import useAuth from "../../hooks/useAuth";
import { getOrCreateDirectChat } from "../../services/chats.service";
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

export default function UserProfile() {
  const { uid } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [reviewsError, setReviewsError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setErr("");
        setReviewsError("");

        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setErr("Пользователь не найден.");
          setProfile(null);
          setReviews([]);
          return;
        }

        setProfile(snap.data());

        try {
          const loadedReviews = await listReviewsForUser(uid);
          setReviews(Array.isArray(loadedReviews) ? loadedReviews : []);
        } catch (reviewsLoadError) {
          console.error(reviewsLoadError);
          setReviews([]);
          setReviewsError("Отзывы временно не загрузились.");
        }
      } catch (error) {
        console.error(error);
        setErr("Не удалось загрузить профиль.");
      } finally {
        setLoading(false);
      }
    };

    if (uid) loadProfile();
  }, [uid]);

  const startChat = async () => {
    if (!user?.uid || !uid || user.uid === uid) return;

    try {
      setStartingChat(true);

      const chatId = await getOrCreateDirectChat({
        currentUserId: user.uid,
        otherUserId: uid,
      });

      nav(`/chats?id=${chatId}`);
    } catch (error) {
      console.error(error);
      alert("Не удалось открыть чат.");
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return <div className="card">Загрузка профиля...</div>;
  }

  if (err) {
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

  if (!profile) {
    return <div className="card">Профиль пуст.</div>;
  }

  const avatar = profile.avatarURL || "";
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const isOwnProfile = user?.uid === uid;
  const statusText = formatLastSeen(profile?.lastSeen, profile?.isOnline);

  return (
    <div style={{ display: "grid", gap: 12 }}>
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
              "radial-gradient(circle at top left, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at bottom right, rgba(16,185,129,0.10), transparent 30%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: 22,
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: "#1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
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
              <span>{(profile.displayName || profile.email || "U")[0].toUpperCase()}</span>
            )}

            <span
              style={{
                position: "absolute",
                right: 3,
                bottom: 3,
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: profile?.isOnline ? "#22c55e" : "rgba(255,255,255,0.25)",
                border: "2px solid #1f2937",
              }}
            />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: 0 }}>{profile.displayName || "Без имени"}</h2>

            <div style={{ opacity: 0.8, marginTop: 6 }}>
              @{profile.username || "username"}
            </div>

            <div style={{ opacity: 0.8, marginTop: 6 }}>
              {profile.email || "Email скрыт"}
            </div>

            <div style={{ opacity: 0.65, marginTop: 6, fontSize: 13 }}>
              {statusText}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {isOwnProfile ? (
              <Link to="/profile/edit" className="btn" style={{ textDecoration: "none" }}>
                Редактировать профиль
              </Link>
            ) : (
              <button className="btn" onClick={startChat} disabled={startingChat}>
                {startingChat ? "Открываю чат..." : "Написать"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>О пользователе</h3>
        <p style={{ margin: 0, opacity: 0.9 }}>
          {profile.bio || "Пока ничего не написал о себе."}
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
          <strong>{profile.role || "client"}</strong>
        </div>

        <div>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Рейтинг</div>
          <strong>{profile.rating ?? 0}</strong>
        </div>

        <div>
          <div style={{ opacity: 0.7, marginBottom: 4 }}>Отзывы</div>
          <strong>{profile.reviewsCount ?? 0}</strong>
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
        <h3 style={{ marginTop: 0 }}>Отзывы</h3>

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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
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
    </div>
  );
}