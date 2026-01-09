import ReactDOM from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import App from "./App";
import LandingPage from "./Landing"
import About from "./About"
import LoginPage from "./Login"

const router = createBrowserRouter([
	{
		path: "/",
		element: <LandingPage />,
	},
	{
		path: "/dashboard",
		element: <App />,
	},
	{
		path: "/login",
		element: <LoginPage/>,
	},
	{
		path: "/about",
		element: <About/>,

	}
]);

const root = document.getElementById("root")!;

ReactDOM.createRoot(root).render(
	<RouterProvider router={router} />,
);

