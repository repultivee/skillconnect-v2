import { Routes, Route } from "react-router-dom";
import Layout from "../components/Layout";

import Home from "../features/posts/Home";
import Login from "../features/auth/Login";
import Register from "../features/auth/Register";
import Dashboard from "../features/dashboard/Dashboard";
import CreatePost from "../features/posts/CreatePost";
import Post from "../features/posts/Post";
import Chat from "../features/chat/Chat";
import Chats from "../features/chat/Chats";
import Profile from "../features/profile/Profile";
import EditProfile from "../features/profile/EditProfile";
import UserProfile from "../features/profile/UserProfile";

import AdminRoute from "../components/AdminRoute";
import AdminPanel from "../pages/admin/AdminPanel";
import Support from "../pages/support/Support";

export default function RoutesPage() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<Post />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreatePost />} />

        <Route path="/chats" element={<Chats />} />
        <Route path="/chat/:chatId" element={<Chat />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/user/:uid" element={<UserProfile />} />

        <Route path="/support" element={<Support />} />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          }
        />
      </Routes>
    </Layout>
  );
}