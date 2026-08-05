import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ensureSession } from "./lib/api";
import { DocumentHead } from "./components/DocumentHead";
import { LandingPage } from "./pages/LandingPage";
import { TodayPage } from "./pages/TodayPage";
import { AssessmentPage } from "./pages/AssessmentPage";
import { ResultsPage } from "./pages/ResultsPage";
import { PlanPage } from "./pages/PlanPage";
import { ChatPage } from "./pages/ChatPage";
import { LibraryPage, LibraryDetailPage } from "./pages/LibraryPage";
import { BlogPage, BlogDetailPage } from "./pages/BlogPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";

/**
 * Warm anonymous session after first paint — do not block the SPA shell on
 * `/api/v1/session` (that request was on the Lighthouse critical path).
 */
function warmSessionInBackground() {
  const run = () => {
    void ensureSession().catch(() => {
      /* API calls will retry via ensureSession() */
    });
  };
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => run(), { timeout: 2500 });
  } else {
    window.setTimeout(run, 1);
  }
}

export function App() {
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    warmSessionInBackground();
    // Surface hard bootstrap failures only if cookies cannot be established
    // after a short delay (offline / API down). Landing still renders.
    const t = window.setTimeout(() => {
      void ensureSession().catch((e) =>
        setBootError(
          e instanceof Error ? e.message : "Không khởi tạo được phiên.",
        ),
      );
    }, 8000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <BrowserRouter>
      <DocumentHead />
      {bootError ? (
        <div
          className="border-b border-amber-200/80 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
          role="status"
        >
          {bootError} — bạn vẫn xem được trang; thử tải lại nếu cần dùng đánh giá
          hoặc hỏi đáp.
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/hom-nay" element={<TodayPage />} />
        <Route path="/danh-gia" element={<AssessmentPage />} />
        <Route path="/ket-qua/:id?" element={<ResultsPage />} />
        <Route path="/ke-hoach" element={<PlanPage />} />
        <Route path="/hoi" element={<ChatPage />} />
        <Route path="/thu-vien" element={<LibraryPage />} />
        <Route path="/thu-vien/:slug" element={<LibraryDetailPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogDetailPage />} />
        <Route path="/ho-so" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
