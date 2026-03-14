import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { db } from "../../firebase/init";
import {
  acceptPendingChatDeal,
  completeDeal,
  markDealDoneByWorker,
} from "../../services/deals.service";
import { createReview, getExistingReviewForDeal } from "../../services/reviews.service";
import { setChatStatus } from "../../services/chats.service";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { SUPPORT_ADMIN_UID, SUPPORT_TITLE } from "../../constants/support";

function formatTime(value) {
  if (!value) return "";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatLastSeen(value, isOnline, isSupport = false) {
  if (isSupport) return "онлайн";
  if (isOnline) return "online";
  if (!value) return "last seen recently";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "last seen recently";

    return `last seen ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "last seen recently";
  }
}

function normalizeProfile(data) {
  return {
    displayName: data?.displayName || "Пользователь",
    username: data?.username || "unknown",
    avatarURL: data?.avatarURL || "",
    isOnline: Boolean(data?.isOnline),
    email: data?.email || "",
    lastSeen: data?.lastSeen || null,
  };
}

function getSupportProfile() {
  return {
    displayName: SUPPORT_TITLE,
    username: "support",
    avatarURL: "",
    isOnline: true,
    email: "support@skillconnect.local",
    lastSeen: null,
  };
}

function Avatar({ profile, fallback = "U", online = false, support = false }) {
  const letter = ((fallback || "U")[0] || "U").toUpperCase();

  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: support ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.05)",
        display: "grid",
        placeItems: "center",
        overflow: "visible",
        border: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
        flexShrink: 0,
        fontWeight: 700,
        fontSize: 18,
      }}
    >
      {profile?.avatarURL && !support ? (
        <img
          src={profile.avatarURL}
          alt="avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      ) : (
        letter
      )}

      <span
        style={{
          position: "absolute",
          right: -3,
          bottom: -3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: online ? "#22c55e" : "rgba(255,255,255,0.25)",
          border: "2px solid #0b0f19",
          zIndex: 2,
        }}
      />
    </div>
  );
}

export default function Chat() {
  const { chatId } = useParams();
  const { user } = useAuth();

  const [chat, setChat] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [myReview, setMyReview] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const bottomRef = useRef(null);
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const chatRef = useMemo(() => doc(db, "chats", chatId), [chatId]);
  const msgsRef = useMemo(() => collection(db, "chats", chatId, "messages"), [chatId]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "44px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
  }, [text]);

  useEffect(() => {
    if (!chatId || !user?.uid) return;

    const unsub = onSnapshot(
      chatRef,
      async (snap) => {
        try {
          if (!snap.exists()) {
            setErr("Чат не найден");
            setLoading(false);
            return;
          }

          const data = { id: snap.id, ...snap.data() };

          if (!Array.isArray(data.members) || !data.members.includes(user.uid)) {
            setErr("У тебя нет доступа к этому чату");
            setLoading(false);
            return;
          }

          const otherTypingUid = Array.isArray(data.members)
            ? data.members.find((m) => m !== user.uid)
            : null;

          setIsOtherTyping(Boolean(data?.typing?.[otherTypingUid]));

          let otherProfile = null;

          if (data.isSupport) {
            otherProfile = getSupportProfile();
          } else {
            const otherUid = data.members.find((m) => m !== user.uid) || null;

            if (otherUid) {
              const otherSnap = await getDoc(doc(db, "users", otherUid));
              if (otherSnap.exists()) {
                otherProfile = normalizeProfile(otherSnap.data());
              }
            }
          }

          setChat(data);
          setOtherUser(otherProfile);
          setLoading(false);

          await updateDoc(chatRef, {
            [`unreadCounts.${user.uid}`]: 0,
          }).catch(() => {});
        } catch (e) {
          setErr(e?.message || "Ошибка загрузки чата");
          setLoading(false);
        }
      },
      (e) => {
        setErr(e?.message || "Ошибка realtime чата");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [chatId, user?.uid, chatRef]);

  useEffect(() => {
    if (!chatId || !user?.uid) return;

    const qy = query(msgsRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(e?.message || "Ошибка realtime")
    );

    return () => unsub();
  }, [chatId, user?.uid, msgsRef]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const isSupportChat = Boolean(chat?.isSupport);
  const isCustomer = chat?.customerId === user?.uid;
  const chatStatus = chat?.status || "accepted";
  const dealStatus = chat?.dealStatus || "active";
  const isDealCompleted = dealStatus === "completed";
  const isWaitingConfirmation = dealStatus === "waiting_confirmation";

  const otherUid = isSupportChat
    ? SUPPORT_ADMIN_UID
    : chat?.members?.find((m) => m !== user?.uid);

  useEffect(() => {
    const loadMyReview = async () => {
      if (!chat?.dealId || !user?.uid || !isDealCompleted || isSupportChat) {
        setMyReview(null);
        return;
      }

      try {
        const existing = await getExistingReviewForDeal({
          dealId: chat.dealId,
          fromUserId: user.uid,
        });

        setMyReview(existing);
      } catch {
        setMyReview(null);
      }
    };

    loadMyReview();
  }, [chat?.dealId, user?.uid, isDealCompleted, isSupportChat]);

  const setTyping = async (value) => {
    if (!chatRef || !user?.uid || !chat) return;

    try {
      await updateDoc(chatRef, {
        [`typing.${user.uid}`]: value,
      });
    } catch {}
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    setErr("");

    const msg = text.trim();
    if (!msg) return;
    if (!user?.uid) return setErr("Сначала войди");
    if (!chatId || !chat) return;

    if (!isSupportChat) {
      if (chatStatus !== "accepted") return setErr("Сейчас писать в этот чат нельзя");
      if (isDealCompleted) return setErr("Сделка завершена. Чат закрыт");
      if (isWaitingConfirmation) {
        return setErr("Сделка ожидает подтверждения. Переписка временно закрыта");
      }
    }

    const receiverUid = Array.isArray(chat.members)
      ? chat.members.find((m) => m !== user.uid)
      : null;

    try {
      setSending(true);

      await addDoc(msgsRef, {
        text: msg,
        senderId: user.uid,
        senderEmail: user.email || "",
        senderName: user.displayName || "",
        createdAt: serverTimestamp(),
      });

      const updatePayload = {
        lastMessage: msg,
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        [`unreadCounts.${user.uid}`]: 0,
      };

      if (receiverUid) {
        updatePayload[`unreadCounts.${receiverUid}`] = increment(1);
      }

      await updateDoc(chatRef, updatePayload);

      await setTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      setText("");
    } catch (e2) {
      setErr(e2?.message || "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    try {
      setErr("");
      setDecisionLoading(true);
      await acceptPendingChatDeal({ chatId });
    } catch (e) {
      setErr(e?.message || "Не удалось принять заявку");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setErr("");
      setDecisionLoading(true);
      await setChatStatus({ chatId, status: "rejected" });
    } catch (e) {
      setErr(e?.message || "Не удалось отклонить заявку");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleWorkerDone = async () => {
    try {
      setErr("");

      if (!chat?.dealId || !chat?.id) {
        return setErr("Не удалось найти dealId/chatId");
      }

      if (isWaitingConfirmation || isDealCompleted) return;

      setActionLoading(true);

      await markDealDoneByWorker({
        dealId: chat.dealId,
        chatId: chat.id,
      });
    } catch (e) {
      setErr(e?.message || "Не удалось отметить работу выполненной");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setErr("");

      if (!chat?.dealId || !chat?.postId) {
        return setErr("Не удалось найти dealId/postId в чате");
      }

      if (isDealCompleted) return setErr("Сделка уже завершена");
      if (!isWaitingConfirmation) {
        return setErr("Сначала исполнитель должен отметить работу выполненной");
      }

      setActionLoading(true);

      await completeDeal({
        dealId: chat.dealId,
        postId: chat.postId,
        chatId: chat.id,
      });
    } catch (e) {
      setErr(e?.message || "Ошибка завершения сделки");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateReview = async () => {
    try {
      setErr("");

      if (!chat?.dealId || !chat?.id || !otherUid) {
        return setErr("Не удалось найти данные для отзыва");
      }

      setReviewLoading(true);

      const reviewId = await createReview({
        dealId: chat.dealId,
        chatId: chat.id,
        fromUserId: user.uid,
        toUserId: otherUid,
        rating: reviewRating,
        text: reviewText,
      });

      setMyReview({
        id: reviewId,
        rating: reviewRating,
        text: reviewText,
      });

      setReviewText("");
    } catch (e) {
      setErr(e?.message || "Не удалось оставить отзыв");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return <div className="card">Загрузка чата...</div>;
  }

  if (err && !chat) {
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

  if (!chat) {
    return <div className="card">Чат не найден</div>;
  }

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
            padding: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            {isSupportChat ? (
              <Avatar profile={null} fallback="S" online={true} support={true} />
            ) : (
              <Link
                to={otherUid ? `/user/${otherUid}` : "#"}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <Avatar
                  profile={otherUser}
                  fallback={(otherUser?.displayName || otherUser?.email || "U")[0]}
                  online={Boolean(otherUser?.isOnline)}
                  support={false}
                />
              </Link>
            )}

            <div style={{ minWidth: 0 }}>
              {isSupportChat ? (
                <>
                  <h2 style={{ margin: 0 }}>{SUPPORT_TITLE}</h2>
                  <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                    @support
                  </div>
                  <div style={{ opacity: 0.6, marginTop: 4, fontSize: 12 }}>
                    {isOtherTyping
                      ? "печатает..."
                      : formatLastSeen(otherUser?.lastSeen, otherUser?.isOnline, true)}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to={otherUid ? `/user/${otherUid}` : "#"}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <h2 style={{ margin: 0 }}>
                      {otherUser?.displayName || "Пользователь"}
                    </h2>
                  </Link>

                  <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>
                    @{otherUser?.username || "unknown"}
                  </div>

                  <div style={{ opacity: 0.6, marginTop: 4, fontSize: 12 }}>
                    {isOtherTyping
                      ? "печатает..."
                      : formatLastSeen(otherUser?.lastSeen, otherUser?.isOnline)}
                  </div>

                  {chat?.postTitle && (
                    <div style={{ opacity: 0.6, marginTop: 4, fontSize: 12 }}>
                      По посту: {chat.postTitle}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!isSupportChat && chatStatus === "accepted" && chat?.dealId && !isDealCompleted && (
            <>
              {!isCustomer && !isWaitingConfirmation && (
                <button className="btn" onClick={handleWorkerDone} disabled={actionLoading}>
                  {actionLoading ? "..." : "Работа выполнена"}
                </button>
              )}

              {isCustomer && isWaitingConfirmation && (
                <button className="btn" onClick={handleComplete} disabled={actionLoading}>
                  {actionLoading ? "..." : "Подтвердить завершение"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {err && chat && (
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

      {!isSupportChat && chatStatus === "pending" && isCustomer && (
        <div className="card" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ opacity: 0.9 }}>
              Исполнитель отправил заявку. Прими или отклони её.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" onClick={handleAccept} disabled={decisionLoading}>
                {decisionLoading ? "..." : "Принять"}
              </button>
              <button className="btn" onClick={handleReject} disabled={decisionLoading}>
                {decisionLoading ? "..." : "Отклонить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isSupportChat && chatStatus === "accepted" && isWaitingConfirmation && (
        <div className="card" style={{ opacity: 0.9 }}>
          {isCustomer
            ? "Исполнитель отметил работу выполненной. Подтверди завершение сделки."
            : "Ты отметил работу выполненной. Ожидай подтверждения заказчика."}
        </div>
      )}

      <div
        className="card"
        style={{
          height: 500,
          overflowY: "auto",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {messages.length === 0 && (
          <div style={{ opacity: 0.75 }}>Пока нет сообщений.</div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {messages.map((m) => {
            const mine = m.senderId === user?.uid;
            const system = m.system === true;
            const time = formatTime(m.createdAt);

            if (system) {
              return (
                <div key={m.id} style={{ display: "grid", justifyItems: "center" }}>
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      fontSize: 13,
                      opacity: 0.85,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  justifyItems: mine ? "end" : "start",
                }}
              >
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "10px 12px 8px",
                    borderRadius: mine ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: mine ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                    wordBreak: "break-word",
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>
                    {m.text}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.55,
                      marginTop: 6,
                      textAlign: "right",
                    }}
                  >
                    {time}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {isSupportChat ? (
        <form
          ref={formRef}
          onSubmit={sendMessage}
          className="card"
          style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
        >
          <textarea
            ref={textareaRef}
            className="input"
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);

              setTyping(Boolean(value.trim()));

              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => {
                setTyping(false);
              }, 1200);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder="Опиши проблему..."
            disabled={sending}
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              minHeight: 44,
              maxHeight: 140,
              overflowY: "auto",
            }}
          />
          <button className="btn" disabled={sending}>
            {sending ? "..." : "Send"}
          </button>
        </form>
      ) : chatStatus === "accepted" ? (
        isDealCompleted ? (
          <>
            <div className="card" style={{ opacity: 0.9 }}>
              Сделка уже завершена. Чат закрыт для новых сообщений.
            </div>

            <div className="card" style={{ display: "grid", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Отзыв</h3>

              {myReview ? (
                <div style={{ opacity: 0.9 }}>
                  Ты уже оставил отзыв: {"★".repeat(Number(myReview.rating || 0))}
                  {myReview.text ? ` — ${myReview.text}` : ""}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="btn"
                        onClick={() => setReviewRating(n)}
                        style={{
                          opacity: reviewRating === n ? 1 : 0.65,
                        }}
                      >
                        {n}★
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="input"
                    rows={4}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Напиши отзыв..."
                    style={{ resize: "vertical" }}
                  />

                  <button className="btn" onClick={handleCreateReview} disabled={reviewLoading}>
                    {reviewLoading ? "..." : "Оставить отзыв"}
                  </button>
                </>
              )}
            </div>
          </>
        ) : isWaitingConfirmation ? (
          <div className="card" style={{ opacity: 0.9 }}>
            Сделка ожидает подтверждения. Переписка временно закрыта.
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={sendMessage}
            className="card"
            style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
          >
            <textarea
              ref={textareaRef}
              className="input"
              value={text}
              onChange={(e) => {
                const value = e.target.value;
                setText(value);

                setTyping(Boolean(value.trim()));

                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  setTyping(false);
                }, 1200);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              placeholder="Сообщение..."
              disabled={sending}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                minHeight: 44,
                maxHeight: 140,
                overflowY: "auto",
              }}
            />
            <button className="btn" disabled={sending}>
              {sending ? "..." : "Send"}
            </button>
          </form>
        )
      ) : (
        <div className="card" style={{ opacity: 0.9 }}>
          {chatStatus === "pending"
            ? "Ожидайте решения заказчика. После принятия заявки чат откроется для общения."
            : "Заявка отклонена. Отправка сообщений недоступна."}
        </div>
      )}
    </div>
  );
}