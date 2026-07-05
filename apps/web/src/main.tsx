import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiffWorkbench } from "./features/diff-workbench/DiffWorkbench";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <DiffWorkbench />
  </StrictMode>
);
