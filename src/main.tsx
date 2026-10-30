import { StrictMode, Suspense, lazy, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { Role } from "@shared/types";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { Loading } from "@/components/Page";
import "./index.css";

try {
  if (localStorage.getItem("nc-theme") === "dark") document.documentElement.classList.add("dark");
} catch {
  // theme is a per-viewer convenience
}

const Landing = lazy(() => import("@/pages/Landing"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Admissions = lazy(() => import("@/pages/admissions/Admissions"));
const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const StudentHome = lazy(() => import("@/pages/student/Home"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const Profile = lazy(() => import("@/pages/Profile"));
const SatHome = lazy(() => import("@/pages/sat/SatHome"));
const SatBank = lazy(() => import("@/pages/sat/Bank"));
const SatQuestionPage = lazy(() => import("@/pages/sat/QuestionPage"));
const SatTestHome = lazy(() => import("@/pages/sat/TestHome"));
const SatTestRun = lazy(() => import("@/pages/sat/TestRun"));
const SatBlitz = lazy(() => import("@/pages/sat/SatBlitz"));
const SatDrills = lazy(() => import("@/pages/sat/SatDrills"));
const Vocab = lazy(() => import("@/pages/sat/Vocab"));
const VocabUnit = lazy(() => import("@/pages/sat/VocabUnit"));
const SatPlan = lazy(() => import("@/pages/sat/Plan"));
const SatCalculator = lazy(() => import("@/pages/sat/Calculator"));
const SatLearn = lazy(() => import("@/pages/sat/Learn"));
const SatSkill = lazy(() => import("@/pages/sat/Learn").then((m) => ({ default: m.SkillPage })));
const IeltsHome = lazy(() => import("@/pages/ielts/IeltsHome"));
const Speaking = lazy(() => import("@/pages/ielts/Speaking"));
const Writing = lazy(() => import("@/pages/ielts/Writing"));
const Reading = lazy(() => import("@/pages/ielts/Reading"));
const Listening = lazy(() => import("@/pages/ielts/Listening"));
const Games = lazy(() => import("@/pages/ielts/Games"));
const Problems = lazy(() => import("@/pages/coding/Problems"));
const ProblemPage = lazy(() => import("@/pages/coding/ProblemPage"));
const Lessons = lazy(() => import("@/pages/coding/Lessons"));
const LessonPage = lazy(() => import("@/pages/coding/LessonPage"));
const CodeBlitz = lazy(() => import("@/pages/coding/CodeBlitz"));
const EngineeringHub = lazy(() => import("@/pages/engineering/EngineeringHub"));
const DroneBuilder = lazy(() => import("@/pages/engineering/DroneBuilder"));
const DroneFly = lazy(() => import("@/pages/engineering/DroneFly"));
const CadLab = lazy(() => import("@/pages/engineering/CadLab"));
const ArduinoLab = lazy(() => import("@/pages/engineering/ArduinoLab"));
const CadStudio = lazy(() => import("@/pages/engineering/CadStudio"));
const Library = lazy(() => import("@/pages/library/Library"));
const EntHome = lazy(() => import("@/pages/ent/EntHome"));
const EntMaster = lazy(() => import("@/pages/ent/EntMaster"));
const EntPractice = lazy(() => import("@/pages/ent/EntPractice"));
const EntTestRun = lazy(() => import("@/pages/ent/EntTestRun"));
const Review = lazy(() => import("@/pages/student/Review"));
const Duels = lazy(() => import("@/pages/student/Duels"));
const Family = lazy(() => import("@/pages/student/Family"));
const ParentView = lazy(() => import("@/pages/ParentView"));
const SharedApp = lazy(() => import("@/pages/SharedApp"));
const DuelPlay = lazy(() => import("@/pages/student/Duels").then((m) => ({ default: m.DuelPlay })));
const Reader = lazy(() => import("@/pages/library/Reader"));

function Guard({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/parent/:token" element={<ParentView />} />
        <Route path="/share/:token" element={<SharedApp />} />

        {/* Full-screen exam and lesson views, outside the app shell */}
        <Route
          path="/sat/test/run/:id"
          element={
            <Guard role="student">
              <SatTestRun />
            </Guard>
          }
        />
        <Route
          path="/coding/lessons/:id"
          element={
            <Guard role="student">
              <LessonPage />
            </Guard>
          }
        />
        <Route
          path="/ent/test/:id"
          element={
            <Guard role="student">
              <EntTestRun />
            </Guard>
          }
        />

        <Route
          element={
            <Guard>
              <AppShell />
            </Guard>
          }
        >
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:id" element={<Reader />} />
        </Route>

        <Route
          element={
            <Guard role="student">
              <AppShell />
            </Guard>
          }
        >
          <Route path="/app" element={<StudentHome />} />
          <Route path="/admissions" element={<Admissions />} />
          <Route path="/ent" element={<EntHome />} />
          <Route path="/ent/master" element={<EntMaster />} />
          <Route path="/review" element={<Review />} />
          <Route path="/family" element={<Family />} />
          <Route path="/duels" element={<Duels />} />
          <Route path="/duels/:id" element={<DuelPlay />} />
          <Route path="/ent/practice/:subject" element={<EntPractice />} />
          <Route path="/sat" element={<SatHome />} />
          <Route path="/sat/bank" element={<SatBank />} />
          <Route path="/sat/q/:id" element={<SatQuestionPage />} />
          <Route path="/sat/test" element={<SatTestHome />} />
          <Route path="/sat/blitz" element={<SatBlitz />} />
          <Route path="/sat/drills" element={<SatDrills />} />
          <Route path="/sat/vocab" element={<Vocab />} />
          <Route path="/sat/vocab/:id" element={<VocabUnit />} />
          <Route path="/sat/plan" element={<SatPlan />} />
          <Route path="/sat/calculator" element={<SatCalculator />} />
          <Route path="/sat/learn" element={<SatLearn />} />
          <Route path="/sat/learn/:id" element={<SatSkill />} />
          <Route path="/ielts" element={<IeltsHome />} />
          <Route path="/ielts/speaking" element={<Speaking />} />
          <Route path="/ielts/writing" element={<Writing />} />
          <Route path="/ielts/reading" element={<Reading />} />
          <Route path="/ielts/listening" element={<Listening />} />
          <Route path="/ielts/games" element={<Games />} />
          <Route path="/coding" element={<Problems />} />
          <Route path="/coding/problems/:id" element={<ProblemPage />} />
          <Route path="/coding/lessons" element={<Lessons />} />
          <Route path="/coding/blitz" element={<CodeBlitz />} />
          <Route path="/engineering" element={<EngineeringHub />} />
          <Route path="/engineering/drone" element={<DroneBuilder />} />
          <Route path="/engineering/drone/fly/:mission" element={<DroneFly />} />
          <Route path="/engineering/cad/:lesson" element={<CadLab />} />
          <Route path="/engineering/arduino/:lesson" element={<ArduinoLab />} />
          <Route path="/engineering/cad-studio" element={<CadStudio />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
