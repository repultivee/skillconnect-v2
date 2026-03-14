import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/init";

/**
 * Старый flow через applications — оставляем, если где-то ещё используется
 */
export async function acceptApplication({ applicationId, postId, clientId, workerId }) {
  if (!applicationId || !postId || !clientId || !workerId) {
    throw new Error("acceptApplication: не хватает данных");
  }

  if (clientId === workerId) {
    throw new Error("Нельзя принять отклик от самого себя");
  }

  await updateDoc(doc(db, "posts", postId), {
    status: "in_progress",
    updatedAt: serverTimestamp(),
  });

  const dealRef = await addDoc(collection(db, "deals"), {
    postId,
    clientId,
    workerId,
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const chatRef = await addDoc(collection(db, "chats"), {
    postId,
    dealId: dealRef.id,
    members: [clientId, workerId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "deals", dealRef.id), {
    chatId: chatRef.id,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "applications", applicationId), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    dealId: dealRef.id,
    chatId: chatRef.id,
    updatedAt: serverTimestamp(),
  });

  return { dealId: dealRef.id, chatId: chatRef.id };
}

export async function findChatIdByDealMembers({ postId, clientId, workerId }) {
  if (!postId || !clientId || !workerId) return null;

  const q = query(
    collection(db, "deals"),
    where("postId", "==", postId),
    where("clientId", "==", clientId),
    where("workerId", "==", workerId),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const deal = snap.docs[0].data();
  return deal.chatId || null;
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

    await updateDoc(doc(db, "chats", d.id), {
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

export async function acceptPendingChatDeal({ chatId }) {
  if (!chatId) throw new Error("chatId обязателен");

  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) throw new Error("Чат не найден");

  const chat = { id: snap.id, ...snap.data() };

  if (!chat.postId || !chat.customerId || !chat.executorId) {
    throw new Error("В чате не хватает данных для создания сделки");
  }

  let dealId = chat.dealId || null;

  if (!dealId) {
    const dealRef = await addDoc(collection(db, "deals"), {
      postId: chat.postId,
      chatId: chat.id,
      clientId: chat.customerId,
      workerId: chat.executorId,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    dealId = dealRef.id;
  }

  await updateDoc(chatRef, {
    status: "accepted",
    dealId,
    dealStatus: "active",
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "posts", chat.postId), {
    status: "in_progress",
    executorId: chat.executorId,
    acceptedChatId: chat.id,
    activeDealId: dealId,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "chats", chat.id, "messages"), {
    text: "Заказчик принял заявку. Теперь чат открыт для общения ✅",
    senderId: "system",
    senderEmail: "",
    senderName: "System",
    createdAt: serverTimestamp(),
    system: true,
  });

  await rejectOtherPendingChatsForPost({
    postId: chat.postId,
    customerId: chat.customerId,
    acceptedChatId: chat.id,
  });

  return { dealId, chatId: chat.id };
}

export async function markDealDoneByWorker({ dealId, chatId }) {
  if (!dealId || !chatId) {
    throw new Error("markDealDoneByWorker: не хватает данных");
  }

  const dealRef = doc(db, "deals", dealId);
  const dealSnap = await getDoc(dealRef);

  if (!dealSnap.exists()) {
    throw new Error("Сделка не найдена");
  }

  const deal = dealSnap.data();

  if (deal?.status === "waiting_confirmation" || deal?.status === "completed") {
    return true;
  }

  await updateDoc(dealRef, {
    status: "waiting_confirmation",
    workerMarkedDoneAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "chats", chatId), {
    dealStatus: "waiting_confirmation",
    updatedAt: serverTimestamp(),
  });

  const systemMsgsSnap = await getDocs(
    query(
      collection(db, "chats", chatId, "messages"),
      where("system", "==", true)
    )
  );

  const alreadyExists = systemMsgsSnap.docs.some((d) => {
    const data = d.data();
    return data?.text === "Исполнитель отметил работу как выполненную. Заказчик должен подтвердить.";
  });

  if (!alreadyExists) {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: "Исполнитель отметил работу как выполненную. Заказчик должен подтвердить.",
      senderId: "system",
      senderEmail: "",
      senderName: "System",
      createdAt: serverTimestamp(),
      system: true,
    });
  }

  return true;
}

export async function completeDeal({ dealId, postId, chatId }) {
  if (!dealId || !postId) {
    throw new Error("completeDeal: не хватает данных");
  }

  const dealRef = doc(db, "deals", dealId);
  const dealSnap = await getDoc(dealRef);

  if (!dealSnap.exists()) {
    throw new Error("Сделка не найдена");
  }

  const deal = dealSnap.data();

  if (deal?.status === "completed") {
    return true;
  }

  await updateDoc(dealRef, {
    status: "completed",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "posts", postId), {
    status: "completed",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (chatId) {
    const chatRef = doc(db, "chats", chatId);

    await updateDoc(chatRef, {
      dealStatus: "completed",
      updatedAt: serverTimestamp(),
    });

    const systemMsgsSnap = await getDocs(
      query(
        collection(db, "chats", chatId, "messages"),
        where("system", "==", true)
      )
    );

    const alreadyCompletedMessage = systemMsgsSnap.docs.some((d) => {
      const data = d.data();
      return data?.text === "Сделка завершена ✅";
    });

    if (!alreadyCompletedMessage) {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "Сделка завершена ✅",
        senderId: "system",
        senderEmail: "",
        senderName: "System",
        createdAt: serverTimestamp(),
        system: true,
      });
    }
  }

  return true;
}