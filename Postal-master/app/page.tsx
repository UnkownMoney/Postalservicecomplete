"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Call Supabase auth signIn function
    const { user, error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    console.log("Signed in user:", user);

    // Retrieve user privilege from our custom "User" table using maybeSingle()
    const { data, error: fetchError } = await supabase
      .from("user")
      .select("priv")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      console.error("Fetch error:", fetchError);
      return;
    }

    if (!data) {
      setError("No user record found for this email.");
      return;
    }

    console.log("Retrieved user privilege:", data);

    // Redirect based on the retrieved privilege
    if (data.priv === true) {
      router.push("/admin"); // Admin Dashboard
    } else if (data.priv === false) {
      router.push("/user"); // Regular User Dashboard
    } else {
      // Handle cases where priv might be null or undefined if necessary
      setError("User privilege not set.");
      router.push("/"); 
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold">Login</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleLogin} className="flex flex-col space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      <button type="button" onClick={() => router.push("/signup")}>
        Sign Up
      </button>
    </div>
  );
}
