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

async function recomputeUserReviewStats(userId) {
  const qy = query(collection(db, "reviews"), where("toUserId", "==", userId));
  const snap = await getDocs(qy);

  const reviews = snap.docs.map((d) => d.data());
  const count = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
  const avg = count ? Math.round((sum / count) * 10) / 10 : 0;

  await updateDoc(doc(db, "users", userId), {
    rating: avg,
    reviewsCount: count,
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  return { rating: avg, reviewsCount: count };
}

export async function getExistingReviewForDeal({ dealId, fromUserId }) {
  if (!dealId || !fromUserId) return null;

  const qy = query(
    collection(db, "reviews"),
    where("dealId", "==", dealId),
    where("fromUserId", "==", fromUserId),
    limit(1)
  );

  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
}

export async function listReviewsForUser(userId) {
  if (!userId) return [];

  const qy = query(
    collection(db, "reviews"),
    where("toUserId", "==", userId)
  );

  const snap = await getDocs(qy);

  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data();
      let fromUser = null;

      if (data.fromUserId) {
        const userSnap = await getDoc(doc(db, "users", data.fromUserId)).catch(() => null);
        if (userSnap?.exists()) {
          fromUser = userSnap.data();
        }
      }

      return {
        id: d.id,
        ...data,
        fromUser,
      };
    })
  );

  rows.sort((a, b) => {
    const da =
      typeof a.createdAt?.toDate === "function"
        ? a.createdAt.toDate().getTime()
        : new Date(a.createdAt || 0).getTime();

    const dbb =
      typeof b.createdAt?.toDate === "function"
        ? b.createdAt.toDate().getTime()
        : new Date(b.createdAt || 0).getTime();

    return dbb - da;
  });

  return rows;
}

export async function createReview({
  dealId,
  chatId,
  fromUserId,
  toUserId,
  rating,
  text,
}) {
  const normalizedRating = Number(rating);

  if (!dealId || !fromUserId || !toUserId) {
    throw new Error("Не хватает данных для отзыва");
  }

  if (fromUserId === toUserId) {
    throw new Error("Нельзя оставить отзыв самому себе");
  }

  if (![1, 2, 3, 4, 5].includes(normalizedRating)) {
    throw new Error("Оценка должна быть от 1 до 5");
  }

  const trimmedText = String(text || "").trim();

  const dealSnap = await getDoc(doc(db, "deals", dealId));
  if (!dealSnap.exists()) {
    throw new Error("Сделка не найдена");
  }

  const deal = dealSnap.data();

  if (deal.status !== "completed") {
    throw new Error("Отзыв можно оставить только после завершения сделки");
  }

  const participants = [deal.clientId, deal.workerId];
  if (!participants.includes(fromUserId) || !participants.includes(toUserId)) {
    throw new Error("Отзыв можно оставить только участнику сделки");
  }

  const existing = await getExistingReviewForDeal({ dealId, fromUserId });
  if (existing) {
    throw new Error("Ты уже оставил отзыв по этой сделке");
  }

  const reviewRef = await addDoc(collection(db, "reviews"), {
    dealId,
    chatId: chatId || null,
    fromUserId,
    toUserId,
    rating: normalizedRating,
    text: trimmedText,
    createdAt: serverTimestamp(),
  });

  await recomputeUserReviewStats(toUserId);

  if (chatId) {
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: `Оставлен отзыв: ${normalizedRating}★`,
      senderId: "system",
      senderEmail: "",
      senderName: "System",
      createdAt: serverTimestamp(),
      system: true,
    }).catch(() => {});
  }

  return reviewRef.id;
}