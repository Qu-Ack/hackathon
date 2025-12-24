import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import App from "./App";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App></App>,
  },
]);

const root = document.getElementById("root")!;

ReactDOM.createRoot(root).render(
  <RouterProvider router={router} />,
);
