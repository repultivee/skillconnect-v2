import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/init";

// Создать отклик
export async function createApplication({ postId, applicantId, applicantEmail, text }) {
  const trimmed = String(text || "").trim();
  if (!postId) throw new Error("postId обязателен");
  if (!applicantId) throw new Error("applicantId обязателен");
  if (!trimmed) throw new Error("Текст отклика пустой");

  // Берём пост, чтобы узнать владельца
  const postSnap = await getDoc(doc(db, "posts", postId));
  if (!postSnap.exists()) throw new Error("Пост не найден");

  const post = postSnap.data();
  const postOwnerId = post.authorId;

  // ❗ Запрет: владелец не может откликаться на свой пост
  if (postOwnerId === applicantId) {
    throw new Error("Нельзя откликнуться на свой пост");
  }

  // (опционально) запретить дубли отклика от того же юзера на тот же пост
  const dupQ = query(
    collection(db, "applications"),
    where("postId", "==", postId),
    where("applicantId", "==", applicantId)
  );
  const dupSnap = await getDocs(dupQ);
  if (!dupSnap.empty) {
    throw new Error("Ты уже отправлял отклик на этот пост");
  }

  const ref = await addDoc(collection(db, "applications"), {
    postId,
    postOwnerId,
    applicantId,
    applicantEmail: applicantEmail || "",
    text: trimmed,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

// Pending отклики на конкретный пост
export async function listPendingApplicationsByPost(postId) {
  const qy = query(
    collection(db, "applications"),
    where("postId", "==", postId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Pending отклики на мои посты (я владелец постов)
export async function listPendingApplicationsByOwner(ownerId) {
  const qy = query(
    collection(db, "applications"),
    where("postOwnerId", "==", ownerId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Accepted отклики на мои посты
export async function listAcceptedApplicationsByOwner(ownerId) {
  const qy = query(
    collection(db, "applications"),
    where("postOwnerId", "==", ownerId),
    where("status", "==", "accepted")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * ✅ Вызывать ПОСЛЕ того как ты создал deal/chat
 * чтобы в application появился chatId и можно было открыть чат из Dashboard.
 */
export async function setApplicationAccepted({ applicationId, chatId, dealId }) {
  if (!applicationId) throw new Error("applicationId обязателен");
  if (!chatId) throw new Error("chatId обязателен");

  await updateDoc(doc(db, "applications", applicationId), {
    status: "accepted",
    chatId,
    dealId: dealId || null,
    acceptedAt: serverTimestamp(),
  });

  return true;
}

export async function listAcceptedApplicationsByApplicant(applicantId) {
  const q = query(
    collection(db, "applications"),
    where("applicantId", "==", applicantId),
    where("status", "==", "accepted")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

