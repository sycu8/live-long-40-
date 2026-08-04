import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ensureSession } from "./lib/api";
import { LandingPage } from "./pages/LandingPage";
import { TodayPage } from "./pages/TodayPage";
import { AssessmentPage } from "./pages/AssessmentPage";
import { ResultsPage } from "./pages/ResultsPage";
import { PlanPage } from "./pages/PlanPage";
import { ChatPage } from "./pages/ChatPage";
import { LibraryPage, LibraryDetailPage } from "./pages/LibraryPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AdminPage } from "./pages/AdminPage";

export function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    ensureSession()
      .then(() => setReady(true))
      .catch((e) =>
        setBootError(e instanceof Error ? e.message : "Không khởi tạo được phiên."),
      );
  }, []);

  if (bootError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl">Không kết nối được dịch vụ</h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">{bootError}</p>
        <p className="mt-3 text-sm">
          Hãy chạy <code>pnpm db:migrate:local</code> và <code>pnpm db:seed:local</code>{" "}
          rồi khởi động lại <code>pnpm dev</code>.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-[var(--color-ink-muted)]">
        Đang khởi tạo Sống An 40+…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/hom-nay" element={<TodayPage />} />
        <Route path="/danh-gia" element={<AssessmentPage />} />
        <Route path="/ket-qua/:id?" element={<ResultsPage />} />
        <Route path="/ke-hoach" element={<PlanPage />} />
        <Route path="/hoi" element={<ChatPage />} />
        <Route path="/thu-vien" element={<LibraryPage />} />
        <Route path="/thu-vien/:slug" element={<LibraryDetailPage />} />
        <Route path="/ho-so" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
