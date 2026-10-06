import AuthForm from "../components/auth-form";
import { emailConfigured } from "../../lib/server/email";
export default function Page() { return <AuthForm signup={false} emailEnabled={emailConfigured()} />; }
