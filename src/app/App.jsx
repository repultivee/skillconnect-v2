import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes";
import { LangProvider } from "../contexts/lang";

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LangProvider>
  );
}