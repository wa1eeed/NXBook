// NextAuth v5 route handler — exposes /api/auth/* (signin, callback,
// session, csrf, etc.). The handlers come from the central auth config.
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
