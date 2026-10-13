import React, { useState } from "react";
import {
    Lock,
    User,
    ArrowRight,
    Sparkles,
    Sun,
    Moon,
    Monitor,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { AppLogo } from "../common/AppLogo";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

export const LoginPage: React.FC = () => {
    const { login, themeMode, setThemeMode } = useApp();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        if (!username.trim()) {
            setErrorMessage("Please enter your username");
            return;
        }
        if (!password) {
            setErrorMessage("Please enter your password");
            return;
        }

        setIsLoading(true);
        const result = await login(username.trim().toLowerCase(), password);
        setIsLoading(false);
        if (!result.success)
            setErrorMessage(result.message || "Invalid username or password.");
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
            {/* Top Bar for Login */}
            <header className="h-16 px-6 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                    <AppLogo size="sm" showSparkle={true} />
                    <span className="font-bold text-slate-900 dark:text-white tracking-tight text-sm md:text-base">
                        Capstone Teaching Assistant
                    </span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <button
                        onClick={() => setThemeMode("light")}
                        className={`p-1.5 rounded-lg transition ${themeMode === "light" ? "bg-white dark:bg-slate-800 shadow-xs text-amber-500 font-medium" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                        title="Light mode"
                    >
                        <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setThemeMode("dark")}
                        className={`p-1.5 rounded-lg transition ${themeMode === "dark" ? "bg-white dark:bg-slate-800 shadow-xs text-indigo-400 font-medium" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                        title="Dark mode"
                    >
                        <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setThemeMode("system")}
                        className={`p-1.5 rounded-lg transition ${themeMode === "system" ? "bg-white dark:bg-slate-800 shadow-xs text-blue-500 font-medium" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                        title="System theme"
                    >
                        <Monitor className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            {/* Main Login Center Container */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
                <div className="w-full max-w-md space-y-6">
                    {/* Welcome Text Section (Exact requirement: Web Application name: Capstone Teaching Assistant) */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            <span>Next-Gen Capstone Advisory Platform</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Capstone Teaching Assistant
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                            Sign in to chat about semester documents, review student
                            milestone deliverables, and access teaching
                            libraries.
                        </p>
                    </div>

                    {/* Login Card */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none transition">
                        <form
                            onSubmit={handleSubmit}
                            noValidate
                            className="space-y-4"
                        >
                            {errorMessage && (
                                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
                                    {errorMessage}
                                </div>
                            )}

                            {/* Username input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Username
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <input
                                        id="login-username-input"
                                        type="text"
                                        placeholder="Enter username"
                                        value={username}
                                        onChange={(e) =>
                                            setUsername(e.target.value)
                                        }
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    />
                                </div>
                            </div>

                            {/* Password input */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <input
                                        id="login-password-input"
                                        type="password"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    />
                                </div>
                            </div>

                            {/* Submit button */}
                            <button
                                id="login-submit-btn"
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition active:scale-[0.99] disabled:opacity-70 cursor-pointer"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Sign In to Workspace</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>

                            {/* Forgot password sits after submit so Tab goes username -> password -> sign in */}
                            <div className="flex justify-end">
                                <button
                                    id="forgot-password-link"
                                    type="button"
                                    onClick={() =>
                                        setIsForgotPasswordOpen(true)
                                    }
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition cursor-pointer"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Footer note */}
                    <div className="text-center text-xs text-slate-400 dark:text-slate-500">
                        Capstone Teaching Assistant &copy; 2026 Academic
                        Advisory System
                    </div>
                </div>
            </div>
            {isForgotPasswordOpen && (
                <ForgotPasswordModal
                    initialIdentifier={username.trim()}
                    onClose={() => setIsForgotPasswordOpen(false)}
                />
            )}
        </div>
    );
};
