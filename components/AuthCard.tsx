"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import {supabase} from "../lib/supabaseClient";

type AuthCardProps = {
    user: User | null;
    onSignOutDone: () => void;
};

export function AuthCard({ user, onSignOutDone }: AuthCardProps) {
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authMessage, setAuthMessage] = useState("");
    const [authLoading, setAuthLoading] = useState(false);

    async function handleAuthSubmit() {
        setAuthLoading(true);
        setAuthMessage("");

        try {
            if (!email.trim() || !password.trim()) {
                setAuthMessage("Email and password are required.");
                return;
            }

            if (authMode === "register") {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (error) {
                    setAuthMessage(error.message);
                    return;
                }

                setAuthMessage(
                    "Account created. Check email if confirmation is enabled."
                );
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    setAuthMessage(error.message);
                    return;
                }

                setAuthMessage("Logged in.");
            }
        } finally {
            setAuthLoading(false);
        }
    }

    async function handleSignOut() {
        await supabase.auth.signOut();
        onSignOutDone();
    }

    return (
        <section className="authPanel">
            {user ? (
                <div className="authRow">
                    <div>
                        <strong>Logged in</strong>
                        <p>{user.email}</p>
                    </div>

                    <button className="secondaryButton" onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>
            ) : (
                <>
                    <div className="authTabs">
                        <button
                            className={authMode === "login" ? "activeTab" : ""}
                            onClick={() => setAuthMode("login")}
                        >
                            Login
                        </button>

                        <button
                            className={authMode === "register" ? "activeTab" : ""}
                            onClick={() => setAuthMode("register")}
                        >
                            Register
                        </button>
                    </div>

                    <div className="authForm">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                        />

                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                        />

                        <button
                            disabled={authLoading}
                            onClick={handleAuthSubmit}
                        >
                            {authLoading
                                ? "Please wait..."
                                : authMode === "login"
                                    ? "Login"
                                    : "Create account"}
                        </button>
                    </div>

                    {authMessage && (
                        <div className="cloudMessage">{authMessage}</div>
                    )}
                </>
            )}
        </section>
    );
}