import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Queries from "@/pages/Queries";
import NewQuery from "@/pages/NewQuery";
import QueryDetail from "@/pages/QueryDetail";
import Runs from "@/pages/Runs";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="queries" element={<Queries />} />
            <Route path="queries/new" element={<NewQuery />} />
            <Route path="queries/:id" element={<QueryDetail />} />
            <Route path="runs" element={<Runs />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0a0a0a",
            border: "1px solid #27272a",
            color: "#fff",
            borderRadius: "2px",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
