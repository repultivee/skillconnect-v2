import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { db } from "../../firebase/init";
import {
  acceptPendingChatDeal,
  completeDeal,
  markDealDoneByWorker,
} from "../../services/deals.service";
import { setChatStatus } from "../../services/chats.service";
import {
  createReview,
  getExistingReviewForDeal,
} from "../../services/reviews.service";
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
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  SUPPORT_ADMIN_UID,
  SUPPORT_TITLE,
  getSupportChatId,
} from "../../constants/support";

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

function isSupportChatDoc(chat) {
  return Boolean(chat?.isSupport) || String(chat?.id || "").startsWith("support_");
}

function statusLabel(chat, isAdminUser) {
  if (isSupportChatDoc(chat)) {
    return isAdminUser ? "Запрос в поддержку" : "Чат поддержки";
  }

  const status = chat?.status || "accepted";

  if (status === "pending") return "Ожидает решения";
  if (status === "rejected") return "Отклонено";
  if (chat?.dealStatus === "completed") return "Сделка завершена";
  if (chat?.dealStatus === "waiting_confirmation") return "Ждёт подтверждения";
  return "Активный чат";
}

function Avatar({ profile, fallback = "U", online = false, support = false }) {
  const letter = ((fallback || "U")[0] || "U").toUpperCase();

  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.10)",
        background: support ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.04)",
        display: "grid",
        placeItems: "center",
        fontSize: 17,
        overflow: "visible",
        position: "relative",
        flexShrink: 0,
        fontWeight: 700,
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
          right: -2,
          bottom: -2,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: online ? "#22c55e" : "rgba(255,255,255,0.25)",
          border: "2px solid #0b0f19",
          zIndex: 2,
        }}
      />
    </div>
  );
}

export default function Chats() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [sp, setSp] = useSearchParams();

  const selectedId = sp.get("id") || "";

  const [items, setItems] = useState([]);
  const [listErr, setListErr] = useState("");
  const [isAdminUser, setIsAdminUser] = useState(false);

  const [chat, setChat] = useState(null);
  const [chatErr, setChatErr] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [text, setText] = useState("");
  const [otherUser, setOtherUser] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const bottomRef = useRef(null);
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isDesktop = useMemo(() => window.innerWidth >= 900, []);
  const chatRef = useMemo(() => (selectedId ? doc(db, "chats", selectedId) : null), [selectedId]);
  const msgsRef = useMemo(
    () => (selectedId ? collection(db, "chats", selectedId, "messages") : null),
    [selectedId]
  );

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "44px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
  }, [text]);

  useEffect(() => {
    const loadRole = async () => {
      if (!user?.uid) {
        setIsAdminUser(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : null;
        setIsAdminUser(data?.role === "admin");
      } catch {
        setIsAdminUser(false);
      }
    };

    loadRole();
  }, [user?.uid]);

  useEffect(() => {
    const ensureSupportChat = async () => {
      if (authLoading || !user?.uid || isAdminUser) return;

      if (!SUPPORT_ADMIN_UID || SUPPORT_ADMIN_UID === "PASTE_ADMIN_UID_HERE") {
        setListErr("Не задан SUPPORT_ADMIN_UID в constants/support.js");
        return;
      }

      try {
        const supportChatId = getSupportChatId(user.uid);
        const supportChatRef = doc(db, "chats", supportChatId);
        const supportChatSnap = await getDoc(supportChatRef);

        if (!supportChatSnap.exists()) {
          await setDoc(supportChatRef, {
            members: [user.uid, SUPPORT_ADMIN_UID],
            isSupport: true,
            title: SUPPORT_TITLE,
            status: "accepted",
            dealStatus: null,
            customerId: user.uid,
            unreadCounts: {
              [user.uid]: 0,
              [SUPPORT_ADMIN_UID]: 0,
            },
            typing: {
              [user.uid]: false,
              [SUPPORT_ADMIN_UID]: false,
            },
            lastMessage: "Здравствуйте! Опишите проблему, и мы ответим вам здесь.",
            lastMessageAt: serverTimestamp(),
            lastMessageSenderId: "system",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });

          await addDoc(collection(db, "chats", supportChatId, "messages"), {
            text: "Здравствуйте! Опишите проблему, и мы ответим вам здесь.",
            system: true,
            senderId: "system",
            createdAt: serverTimestamp(),
          });
        }

        setListErr("");
      } catch (err) {
        console.error("support chat create error:", err);
        setListErr(err?.message || "Не удалось создать чат поддержки");
      }
    };

    ensureSupportChat();
  }, [authLoading, user?.uid, isAdminUser]);

  useEffect(() => {
    if (authLoading || !user?.uid) return;

    setListErr("");

    if (isAdminUser) {
      const supportChatsQuery = query(
        collection(db, "chats"),
        where("isSupport", "==", true),
        orderBy("updatedAt", "desc")
      );

      const unsub = onSnapshot(
        supportChatsQuery,
        async (snap) => {
          try {
            const rawChats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

            const enriched = await Promise.all(
              rawChats.map(async (c) => {
                try {
                  const customerUid = Array.isArray(c.members)
                    ? c.members.find((m) => m !== SUPPORT_ADMIN_UID) || null
                    : null;

                  let customerProfile = null;

                  if (customerUid) {
                    const userSnap = await getDoc(doc(db, "users", customerUid));
                    if (userSnap.exists()) {
                      customerProfile = normalizeProfile(userSnap.data());
                    }
                  }

                  return {
                    ...c,
                    otherUid: customerUid,
                    otherProfile: customerProfile,
                  };
                } catch (err) {
                  console.error("support profile load error:", err);
                  return {
                    ...c,
                    otherUid: null,
                    otherProfile: null,
                  };
                }
              })
            );

            setItems(enriched);

            if (!selectedId && enriched.length > 0) {
              setSp((prev) => {
                const next = new URLSearchParams(prev);
                next.set("id", enriched[0].id);
                return next;
              });
            }
          } catch (err) {
            console.error(err);
            setListErr("Не удалось загрузить support-чаты");
          }
        },
        (err) => {
          console.error(err);
          setListErr(err?.message || "Не удалось загрузить support-чаты");
        }
      );

      return () => unsub();
    }

    const chatsQuery = query(
      collection(db, "chats"),
      where("members", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      chatsQuery,
      async (snap) => {
        try {
          const rawChats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          const enriched = await Promise.all(
            rawChats.map(async (c) => {
              try {
                if (isSupportChatDoc(c)) {
                  return {
                    ...c,
                    otherUid: SUPPORT_ADMIN_UID,
                    otherProfile: getSupportProfile(),
                  };
                }

                const otherUid = Array.isArray(c.members)
                  ? c.members.find((m) => m !== user.uid) || null
                  : null;

                if (!otherUid) {
                  return {
                    ...c,
                    otherUid: null,
                    otherProfile: null,
                  };
                }

                const userRef = doc(db, "users", otherUid);
                const userSnap = await getDoc(userRef);

                let otherProfile = null;

                if (userSnap.exists()) {
                  otherProfile = normalizeProfile(userSnap.data());
                }

                return {
                  ...c,
                  otherUid,
                  otherProfile,
                };
              } catch (err) {
                console.error("profile load error:", err);
                return {
                  ...c,
                  otherUid: null,
                  otherProfile: null,
                };
              }
            })
          );

          const sorted = [...enriched].sort((a, b) => {
            const aSupport = isSupportChatDoc(a);
            const bSupport = isSupportChatDoc(b);

            if (aSupport && !bSupport) return -1;
            if (!aSupport && bSupport) return 1;
            return 0;
          });

          const deduped = [];
          let supportAdded = false;

          for (const item of sorted) {
            const support = isSupportChatDoc(item);

            if (support) {
              if (supportAdded) continue;
              supportAdded = true;
            }

            deduped.push(item);
          }

          setItems(deduped);

          if (!selectedId && deduped.length > 0) {
            const supportItem = deduped.find((item) => isSupportChatDoc(item));
            const firstId = supportItem?.id || deduped[0].id;

            setSp((prev) => {
              const next = new URLSearchParams(prev);
              next.set("id", firstId);
              return next;
            });
          }
        } catch (err) {
          console.error(err);
          setListErr("Не удалось загрузить чаты");
        }
      },
      (err) => {
        console.error(err);
        setListErr(err?.message || "Не удалось загрузить чаты");
      }
    );

    return () => unsub();
  }, [authLoading, user?.uid, isAdminUser, selectedId, setSp]);

  useEffect(() => {
    if (!user?.uid) return;

    if (!selectedId) {
      setChat(null);
      setMessages([]);
      setChatErr("");
      setOtherUser(null);
      setMyReview(null);
      setIsOtherTyping(false);
      return;
    }

    let alive = true;

    const unsub = onSnapshot(
      chatRef,
      async (snap) => {
        try {
          setChatErr("");

          if (!snap.exists()) throw new Error("Чат не найден");

          const data = { id: snap.id, ...snap.data() };

          if (!Array.isArray(data.members) || !data.members.includes(user.uid)) {
            throw new Error("У тебя нет доступа к этому чату");
          }

          const support = isSupportChatDoc(data);

          const otherTypingUid = Array.isArray(data.members)
            ? data.members.find((m) => m !== user.uid)
            : null;

          setIsOtherTyping(Boolean(data?.typing?.[otherTypingUid]));

          let loadedOtherUser = null;

          if (support) {
            if (isAdminUser) {
              const customerUid = data.members.find((m) => m !== SUPPORT_ADMIN_UID) || null;

              if (customerUid) {
                const userSnap = await getDoc(doc(db, "users", customerUid));
                if (userSnap.exists()) {
                  loadedOtherUser = normalizeProfile(userSnap.data());
                }
              }
            } else {
              loadedOtherUser = getSupportProfile();
            }
          } else {
            const otherUid = data.members.find((m) => m !== user.uid) || null;

            if (otherUid) {
              const userSnap = await getDoc(doc(db, "users", otherUid));
              if (userSnap.exists()) {
                loadedOtherUser = normalizeProfile(userSnap.data());
              }
            }
          }

          if (alive) {
            setChat(data);
            setOtherUser(loadedOtherUser);
          }

          await updateDoc(chatRef, {
            [`unreadCounts.${user.uid}`]: 0,
          }).catch(() => {});
        } catch (e) {
          if (alive) setChatErr(e?.message || "Ошибка загрузки чата");
        }
      },
      (e) => {
        if (alive) setChatErr(e?.message || "Ошибка realtime чата");
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [selectedId, user?.uid, chatRef, isAdminUser]);

  useEffect(() => {
    if (!user?.uid || !selectedId || !msgsRef) return;

    setChatErr("");

    const qy = query(msgsRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setChatErr(e?.message || "Ошибка realtime сообщений")
    );

    return () => unsub();
  }, [selectedId, user?.uid, msgsRef]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const loadMyReview = async () => {
      if (!chat?.dealId || !user?.uid || chat?.dealStatus !== "completed" || isSupportChatDoc(chat)) {
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
  }, [chat?.dealId, chat?.dealStatus, chat?.id, user?.uid]);

  const pickChat = async (id) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", id);
      return next;
    });

    if (user?.uid) {
      await updateDoc(doc(db, "chats", id), {
        [`unreadCounts.${user.uid}`]: 0,
      }).catch(() => {});
    }
  };

  const supportCurrent = isSupportChatDoc(chat);
  const chatStatus = chat?.status || "accepted";
  const isCustomer = chat?.customerId === user?.uid;
  const dealStatus = chat?.dealStatus || "active";
  const isDealCompleted = dealStatus === "completed";
  const isWaitingConfirmation = dealStatus === "waiting_confirmation";

  const otherUid = supportCurrent
    ? isAdminUser
      ? chat?.members?.find((m) => m !== SUPPORT_ADMIN_UID)
      : SUPPORT_ADMIN_UID
    : chat?.members?.find((m) => m !== user?.uid);

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
    setChatErr("");

    const msg = text.trim();
    if (!msg) return;
    if (!user?.uid) return setChatErr("Сначала войди");
    if (!selectedId) return setChatErr("Сначала выбери чат");
    if (!msgsRef || !chatRef || !chat) return;

    if (!supportCurrent) {
      if (chatStatus !== "accepted") return setChatErr("Сейчас писать в этот чат нельзя");
      if (isDealCompleted) return setChatErr("Сделка завершена. Чат закрыт");
      if (isWaitingConfirmation) {
        return setChatErr("Сделка ожидает подтверждения. Переписка временно закрыта");
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

      setItems((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((c) => c.id === selectedId);

        if (index !== -1) {
          const current = { ...updated[index] };
          current.lastMessage = msg;
          current.lastMessageAt = new Date();
          current.updatedAt = new Date();
          current.lastMessageSenderId = user.uid;

          const unreadCounts = { ...(current.unreadCounts || {}) };
          unreadCounts[user.uid] = 0;
          if (receiverUid) unreadCounts[receiverUid] = (unreadCounts[receiverUid] || 0) + 1;
          current.unreadCounts = unreadCounts;

          updated.splice(index, 1);
          updated.unshift(current);
        }

        return updated;
      });

      setText("");
    } catch (e2) {
      setChatErr(e2?.message || "Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    try {
      setChatErr("");
      setDecisionLoading(true);
      await acceptPendingChatDeal({ chatId: selectedId });
    } catch (e) {
      setChatErr(e?.message || "Не удалось принять заявку");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setChatErr("");
      setDecisionLoading(true);
      await setChatStatus({ chatId: selectedId, status: "rejected" });
    } catch (e) {
      setChatErr(e?.message || "Не удалось отклонить заявку");
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleWorkerDone = async () => {
    try {
      setChatErr("");

      if (!chat?.dealId || !chat?.id) {
        return setChatErr("Не удалось найти dealId/chatId");
      }

      if (isWaitingConfirmation || isDealCompleted) return;

      setActionLoading(true);

      await markDealDoneByWorker({
        dealId: chat.dealId,
        chatId: chat.id,
      });
    } catch (e) {
      setChatErr(e?.message || "Не удалось отметить работу выполненной");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setChatErr("");

      if (!chat?.dealId || !chat?.postId) {
        return setChatErr("Не удалось найти dealId/postId в чате");
      }

      if (isDealCompleted) return setChatErr("Сделка уже завершена");
      if (!isWaitingConfirmation) {
        return setChatErr("Сначала исполнитель должен отметить работу выполненной");
      }

      setActionLoading(true);

      await completeDeal({
        dealId: chat.dealId,
        postId: chat.postId,
        chatId: chat.id,
      });
    } catch (e) {
      setChatErr(e?.message || "Ошибка завершения сделки");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateReview = async () => {
    try {
      setChatErr("");

      if (!chat?.dealId || !chat?.id || !otherUid) {
        return setChatErr("Не удалось найти данные для отзыва");
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
      setChatErr(e?.message || "Не удалось оставить отзыв");
    } finally {
      setReviewLoading(false);
    }
  };

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="card">
        <div style={{ opacity: 0.85, marginBottom: 10 }}>
          Чтобы открыть чаты — нужно войти.
        </div>
        <Link to="/login" className="btn">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Чаты</h2>
          <div style={{ opacity: 0.7, marginTop: 6, fontSize: 13 }}>{user.email}</div>
        </div>

        <button className="btn" onClick={() => nav("/")}>
          На главную
        </button>
      </div>

      {listErr && (
        <div
          className="card"
          style={{
            border: "1px solid rgba(255,99,99,0.25)",
            color: "#ff9b9b",
          }}
        >
          {listErr}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "380px minmax(0, 1fr)" : "1fr",
          gap: 12,
          height: isDesktop ? "72vh" : "auto",
          maxHeight: isDesktop ? "760px" : "none",
          minHeight: 0,
        }}
      >
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: 14,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ opacity: 0.8, fontSize: 13 }}>Мои диалоги</div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: 14, opacity: 0.8 }}>Пока нет чатов.</div>
            ) : (
              <div style={{ display: "grid" }}>
                {items.map((c) => {
                  const active = c.id === selectedId;
                  const last = c.lastMessage || "Нет сообщений";
                  const other = c.otherProfile;
                  const unread = Number(c?.unreadCounts?.[user.uid] || 0);
                  const lastTime = formatTime(c.lastMessageAt || c.updatedAt);
                  const support = isSupportChatDoc(c);

                  const displayName = support
                    ? isAdminUser
                      ? other?.displayName || "Пользователь"
                      : SUPPORT_TITLE
                    : other?.displayName || "Пользователь";

                  const username = support
                    ? isAdminUser
                      ? other?.username || "unknown"
                      : "support"
                    : other?.username || "unknown";

                  const avatarLetter = support
                    ? isAdminUser
                      ? ((displayName || "U")[0] || "U").toUpperCase()
                      : "S"
                    : (displayName || "U")[0].toUpperCase();

                  return (
                    <div
                      key={c.id}
                      onClick={() => pickChat(c.id)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "52px 1fr",
                        gap: 12,
                        padding: "12px 14px",
                        cursor: "pointer",
                        background: active ? "rgba(255,255,255,0.06)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        transition: "background .15s ease",
                      }}
                    >
                      <Avatar
                        profile={other}
                        fallback={avatarLetter}
                        online={support && !isAdminUser ? true : Boolean(other?.isOnline)}
                        support={Boolean(support && !isAdminUser)}
                      />

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: "inherit",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {displayName}
                            {support && !isAdminUser && (
                              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                                закреплён
                              </span>
                            )}
                          </div>

                          <span style={{ fontSize: 12, opacity: 0.55, flexShrink: 0 }}>
                            {lastTime}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                          @{username}
                        </div>

                        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                          {statusLabel(c, isAdminUser)}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: 10,
                            marginTop: 6,
                          }}
                        >
                          <div
                            style={{
                              opacity: 0.85,
                              fontSize: 13,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {last}
                          </div>

                          {unread > 0 && (
                            <div
                              style={{
                                minWidth: 20,
                                height: 20,
                                padding: "0 6px",
                                borderRadius: 999,
                                background: "#ef4444",
                                color: "#fff",
                                fontSize: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                              }}
                            >
                              {unread > 99 ? "99+" : unread}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {isDesktop ? (
          <div
            className="card"
            style={{
              minHeight: 0,
              height: "100%",
              display: "grid",
              gridTemplateRows: "82px minmax(0, 1fr) auto",
              gap: 12,
              overflow: "hidden",
            }}
          >
            {!selectedId ? (
              <div style={{ opacity: 0.75, paddingTop: 8 }}>Выбери чат слева</div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    minHeight: 0,
                    flexShrink: 0,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                    {supportCurrent && !isAdminUser ? (
                      <Avatar
                        profile={null}
                        fallback="S"
                        online={true}
                        support={true}
                      />
                    ) : otherUid ? (
                      <Link
                        to={`/user/${otherUid}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <Avatar
                          profile={otherUser}
                          fallback={(otherUser?.displayName || otherUser?.email || "U")[0]}
                          online={Boolean(otherUser?.isOnline)}
                          support={false}
                        />
                      </Link>
                    ) : (
                      <Avatar
                        profile={otherUser}
                        fallback={(otherUser?.displayName || otherUser?.email || "U")[0]}
                        online={Boolean(otherUser?.isOnline)}
                        support={false}
                      />
                    )}

                    <div style={{ minWidth: 0 }}>
                      {supportCurrent && !isAdminUser ? (
                        <>
                          <div style={{ fontWeight: 700 }}>{SUPPORT_TITLE}</div>
                          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 4 }}>
                            @support
                          </div>
                          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 2 }}>
                            {isOtherTyping
                              ? "печатает..."
                              : formatLastSeen(otherUser?.lastSeen, otherUser?.isOnline, true)}
                          </div>
                        </>
                      ) : (
                        <>
                          {otherUid ? (
                            <Link
                              to={`/user/${otherUid}`}
                              style={{
                                fontWeight: 700,
                                color: "inherit",
                                textDecoration: "none",
                              }}
                            >
                              {otherUser?.displayName || "Пользователь"}
                            </Link>
                          ) : (
                            <div style={{ fontWeight: 700 }}>
                              {otherUser?.displayName || "Пользователь"}
                            </div>
                          )}

                          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 4 }}>
                            @{otherUser?.username || "unknown"}
                          </div>

                          <div style={{ opacity: 0.65, fontSize: 12, marginTop: 2 }}>
                            {isOtherTyping
                              ? "печатает..."
                              : formatLastSeen(
                                  otherUser?.lastSeen,
                                  otherUser?.isOnline,
                                  supportCurrent && !isAdminUser
                                )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!supportCurrent && chatStatus === "accepted" && chat?.dealId && !isDealCompleted && (
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

                {(chatErr || (!supportCurrent && chatStatus === "accepted" && isWaitingConfirmation)) && (
                  <div style={{ display: "grid", gap: 10 }}>
                    {chatErr && (
                      <div
                        className="card"
                        style={{
                          border: "1px solid rgba(255,99,99,0.25)",
                          color: "#ff9b9b",
                        }}
                      >
                        {chatErr}
                      </div>
                    )}

                    {!supportCurrent && chatStatus === "accepted" && isWaitingConfirmation && (
                      <div className="card" style={{ opacity: 0.9 }}>
                        {isCustomer
                          ? "Исполнитель отметил работу выполненной. Подтверди завершение сделки."
                          : "Ты отметил работу выполненной. Ожидай подтверждения заказчика."}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="card"
                  style={{
                    minHeight: 0,
                    height: "100%",
                    overflowY: "auto",
                    overflowX: "hidden",
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

                {supportCurrent ? (
                  <form
                    ref={formRef}
                    onSubmit={sendMessage}
                    className="card"
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-end",
                      borderRadius: 18,
                      padding: 12,
                      flexShrink: 0,
                    }}
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
                      placeholder={isAdminUser ? "Ответить пользователю..." : "Опиши проблему..."}
                      disabled={sending}
                      rows={1}
                      style={{
                        flex: 1,
                        resize: "none",
                        minHeight: 44,
                        maxHeight: 120,
                        overflowY: "auto",
                      }}
                    />
                    <button
                      className="btn"
                      disabled={sending}
                      style={{ flexShrink: 0, height: 44, alignSelf: "flex-end" }}
                    >
                      {sending ? "..." : "Send"}
                    </button>
                  </form>
                ) : chatStatus === "accepted" ? (
                  isDealCompleted ? (
                    <>
                      <div className="card" style={{ opacity: 0.9, flexShrink: 0 }}>
                        Сделка уже завершена. Чат закрыт для новых сообщений.
                      </div>

                      <div className="card" style={{ display: "grid", gap: 10, flexShrink: 0 }}>
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
                    <div className="card" style={{ opacity: 0.9, flexShrink: 0 }}>
                      Сделка ожидает подтверждения. Переписка временно закрыта.
                    </div>
                  ) : (
                    <form
                      ref={formRef}
                      onSubmit={sendMessage}
                      className="card"
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-end",
                        borderRadius: 18,
                        padding: 12,
                        flexShrink: 0,
                      }}
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
                          maxHeight: 120,
                          overflowY: "auto",
                        }}
                      />
                      <button
                        className="btn"
                        disabled={sending}
                        style={{ flexShrink: 0, height: 44, alignSelf: "flex-end" }}
                      >
                        {sending ? "..." : "Send"}
                      </button>
                    </form>
                  )
                ) : chatStatus === "pending" ? (
                  isCustomer ? (
                    <div
                      className="card"
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 12,
                        padding: 16,
                        flexShrink: 0,
                        flexWrap: "wrap",
                      }}
                    >
                      <button className="btn" onClick={handleAccept} disabled={decisionLoading}>
                        {decisionLoading ? "..." : "Принять"}
                      </button>

                      <button className="btn" onClick={handleReject} disabled={decisionLoading}>
                        {decisionLoading ? "..." : "Отклонить"}
                      </button>
                    </div>
                  ) : (
                    <div className="card" style={{ opacity: 0.9, flexShrink: 0 }}>
                      Ожидайте решения заказчика. После принятия заявки чат откроется для общения.
                    </div>
                  )
                ) : (
                  <div className="card" style={{ opacity: 0.9, flexShrink: 0 }}>
                    Заявка отклонена. Отправка сообщений недоступна.
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="card">
            <div style={{ opacity: 0.8 }}>
              На узком экране открой чат отдельной страницей:
            </div>
            <div style={{ marginTop: 10 }}>
              {selectedId ? (
                <button className="btn" onClick={() => nav(`/chat/${selectedId}`)}>
                  Открыть
                </button>
              ) : (
                <div style={{ opacity: 0.7 }}>Выбери чат выше</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}