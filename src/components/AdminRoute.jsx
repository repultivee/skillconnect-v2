import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/init";
import useAuth from "../hooks/useAuth";

export default function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth();

  const [checkingRole, setCheckingRole] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;

      if (!user?.uid) {
        setAllowed(false);
        setCheckingRole(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : null;
        setAllowed(data?.role === "admin");
      } catch (error) {
        console.error("AdminRoute error:", error);
        setAllowed(false);
      } finally {
        setCheckingRole(false);
      }
    };

    checkAdmin();
  }, [user?.uid, authLoading]);

  if (authLoading || checkingRole) {
    return <div className="card">Проверка доступа...</div>;
  }

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}