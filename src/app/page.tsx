/**
 * app/page.tsx — Hub Dashboard (Home)
 * GIGW 3.0 · WCAG 2.2 AA
 * H1: "Welcome to InBridge" → H2: "Quick Actions" & "Notifications"
 */
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/chat");
}