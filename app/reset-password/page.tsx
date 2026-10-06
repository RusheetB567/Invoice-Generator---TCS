import { Suspense } from "react";
import AccountHelp from "../components/account-help";
import { emailConfigured } from "../../lib/server/email";
export default function Page() { return <Suspense fallback={<p>Opening password reset…</p>}><AccountHelp reset enabled={emailConfigured()} /></Suspense>; }
