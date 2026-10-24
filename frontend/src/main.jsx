// PrimeReact (DatePicker / TimePicker / MultiSelect) base styles first, so
// index.css can re-skin them with the app's theme colors.
import "primereact/resources/themes/lara-light-teal/theme.css";
import "primereact/resources/primereact.min.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./store/store";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "./components/Toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster />
      </Provider>
    </ThemeProvider>
  </React.StrictMode>
);
