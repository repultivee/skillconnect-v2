import {
  doc,
  getDoc,
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase/init";

export async function getPost(postId) {
  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createPost({
  title,
  description,
  category,
  budget,
  authorId,
  authorName,
  authorEmail,
}) {
  const ref = await addDoc(collection(db, "posts"), {
    title: String(title || "").trim(),
    description: String(description || "").trim(),
    category: category || "Other",
    budget: Number(budget || 0),
    authorId,
    authorName: String(authorName || "").trim() || "User",
    authorEmail: String(authorEmail || "").trim() || "",
    status: "open",
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function listPosts() {
  const q = query(
    collection(db, "posts"),
    where("status", "==", "open"),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}