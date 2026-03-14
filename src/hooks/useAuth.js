import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/init";

export default function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = ещё грузится
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let currentUid = null;

    const setPresence = async (uid, isOnline, extra = {}) => {
      if (!uid) return;

      try {
        await setDoc(
          doc(db, "users", uid),
          {
            uid,
            isOnline,
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...extra,
          },
          { merge: true }
        );
      } catch (e) {
        console.error("presence error:", e);
      }
    };

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;

      try {
        if (firebaseUser) {
          currentUid = firebaseUser.uid;
          setUser(firebaseUser);

          await setPresence(firebaseUser.uid, true, {
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "User",
          });
        } else {
          if (currentUid) {
            await setPresence(currentUid, false);
          }

          currentUid = null;
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    const handleBeforeUnload = () => {
      if (!currentUid) return;

      setDoc(
        doc(db, "users", currentUid),
        {
          isOnline: false,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => console.error("beforeunload presence error:", e));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      active = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      unsub();
    };
  }, []);

  return { user, loading };
}