import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/init";

function makePairKey(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export async function listMyChats(userId) {
  if (!userId) return [];

  const qy = query(
    collection(db, "chats"),
    where("members", "array-contains", userId),
    orderBy("updatedAt", "desc")
  );

  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findExistingPostChat({ postId, customerId, executorId }) {
  const qy = query(
    collection(db, "chats"),
    where("members", "array-contains", executorId),
    where("postId", "==", postId),
    where("customerId", "==", customerId),
    where("executorId", "==", executorId)
  );

  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
}

export async function findExistingDirectChat({ userA, userB }) {
  if (!userA || !userB) return null;

  const pairKey = makePairKey(userA, userB);

  const qy = query(
    collection(db, "chats"),
    where("type", "==", "direct"),
    where("pairKey", "==", pairKey)
  );

  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
}

export async function getOrCreateDirectChat({
  currentUserId,
  otherUserId,
}) {
  if (!currentUserId) throw new Error("currentUserId обязателен");
  if (!otherUserId) throw new Error("otherUserId обязателен");
  if (currentUserId === otherUserId) {
    throw new Error("Нельзя создать чат с самим собой");
  }

  const existing = await findExistingDirectChat({
    userA: currentUserId,
    userB: otherUserId,
  });

  if (existing) return existing.id;

  const pairKey = makePairKey(currentUserId, otherUserId);

  const chatRef = await addDoc(collection(db, "chats"), {
    type: "direct",
    pairKey,
    members: [currentUserId, otherUserId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "",
    lastMessageAt: null,
    lastMessageSenderId: null,
    unreadCounts: {
      [currentUserId]: 0,
      [otherUserId]: 0,
    },
  });

  return chatRef.id;
}

export async function createPendingChat({
  postId,
  postTitle,
  customerId,
  executorId,
  starterText,
  senderId,
  senderEmail,
  senderName,
}) {
  const trimmed = String(starterText || "").trim();

  if (!postId) throw new Error("postId обязателен");
  if (!customerId) throw new Error("customerId обязателен");
  if (!executorId) throw new Error("executorId обязателен");
  if (!trimmed) throw new Error("Текст заявки пустой");
  if (customerId === executorId) throw new Error("Нельзя создать чат с самим собой");

  const existing = await findExistingPostChat({ postId, customerId, executorId });
  if (existing) return existing.id;

  const chatRef = await addDoc(collection(db, "chats"), {
    type: "post_application",
    postId,
    postTitle: postTitle || "",
    customerId,
    executorId,
    members: [customerId, executorId],
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: senderId || executorId,
    unreadCounts: {
      [customerId]: 1,
      [executorId]: 0,
    },
  });

  await addDoc(collection(db, "chats", chatRef.id, "messages"), {
    text: trimmed,
    senderId: senderId || executorId,
    senderEmail: senderEmail || "",
    senderName: senderName || "",
    createdAt: serverTimestamp(),
    system: false,
  });

  return chatRef.id;
}

async function rejectOtherPendingChatsForPost({ postId, customerId, acceptedChatId }) {
  if (!postId || !customerId) return;

  const qy = query(
    collection(db, "chats"),
    where("members", "array-contains", customerId),
    where("postId", "==", postId)
  );

  const snap = await getDocs(qy);

  const jobs = snap.docs.map(async (d) => {
    if (d.id === acceptedChatId) return;

    const data = d.data();

    if ((data.status || "accepted") !== "pending") return;

    const otherChatRef = doc(db, "chats", d.id);

    await updateDoc(otherChatRef, {
      status: "rejected",
    });

    await addDoc(collection(db, "chats", d.id, "messages"), {
      text: "Заказ уже принят другим исполнителем.",
      senderId: "system",
      senderEmail: "",
      senderName: "System",
      createdAt: serverTimestamp(),
      system: true,
    });
  });

  await Promise.all(jobs);
}

export async function setChatStatus({ chatId, status }) {
  if (!chatId) throw new Error("chatId обязателен");
  if (!["accepted", "rejected"].includes(status)) {
    throw new Error("Некорректный статус");
  }

  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) throw new Error("Чат не найден");

  const chat = { id: snap.id, ...snap.data() };

  await updateDoc(chatRef, {
    status,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "chats", chatId, "messages"), {
    text:
      status === "accepted"
        ? "Заказчик принял заявку. Теперь чат открыт для общения ✅"
        : "Заказчик отклонил заявку. Отправка сообщений отключена.",
    senderId: "system",
    senderEmail: "",
    senderName: "System",
    createdAt: serverTimestamp(),
    system: true,
  });

  if (status === "accepted" && chat.postId) {
    await updateDoc(doc(db, "posts", chat.postId), {
      status: "in_progress",
      executorId: chat.executorId || null,
      acceptedChatId: chat.id,
      updatedAt: serverTimestamp(),
    });

    await rejectOtherPendingChatsForPost({
      postId: chat.postId,
      customerId: chat.customerId,
      acceptedChatId: chat.id,
    });
  }

  return true;
}