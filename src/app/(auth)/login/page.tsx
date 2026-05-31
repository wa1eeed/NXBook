import { Suspense } from "react"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
