import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "./store/auth"
import { Layout } from "./components/Layout"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import DisruptionCenter from "./pages/DisruptionCenter"
import RecoveryPlanner from "./pages/RecoveryPlanner"
import Copilot from "./pages/Copilot"
import Timeline from "./pages/Timeline"
import Alerts from "./pages/Alerts"
import Analytics from "./pages/Analytics"

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/disruptions" element={<Protected><DisruptionCenter /></Protected>} />
      <Route path="/recovery" element={<Protected><RecoveryPlanner /></Protected>} />
      <Route path="/copilot" element={<Protected><Copilot /></Protected>} />
      <Route path="/timeline" element={<Protected><Timeline /></Protected>} />
      <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
