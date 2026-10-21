import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LimiteErro } from "./components/LimiteErro";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LimiteErro>
      <App />
    </LimiteErro>
  </StrictMode>,
);
