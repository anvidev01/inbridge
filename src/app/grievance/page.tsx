/**
 * app/grievance/page.tsx: The old grievance form could never submit
 * (see CLAUDE.md). Complaints are now drafted in the chat's grievance mode,
 * which hands off to pgportal.gov.in; InBridge does not file them.
 */
import { redirect } from "next/navigation";

export default function GrievancePage() {
    redirect("/chat?mode=grievance");
}
