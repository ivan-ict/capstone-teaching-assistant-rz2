import React, { useState } from "react";
import { X, UserPlus, ShieldAlert, Mail } from "lucide-react";
import { useApp } from "../../context/AppContext";

interface AddSupervisorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AddSupervisorModal: React.FC<AddSupervisorModalProps> = ({
    isOpen,
    onClose,
}) => {
    const { faculties, addSupervisor, supervisors, semesters, setActiveAdminView } = useApp();

    const [formData, setFormData] = useState({
        username: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        semesterId: "",
        faculty: faculties[0]?.name || "Computer Science",
    });

    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanUsername = formData.username.trim();
        if (
            !cleanUsername ||
            !formData.firstName.trim() ||
            !formData.lastName.trim() ||
            !formData.email.trim() || !formData.semesterId
        ) {
            setError("Please fill in all required fields.");
            return;
        }
        // Check if username already exists
        const isDuplicateUsername = supervisors.some(
            (s) => s.username.toLowerCase() === cleanUsername.toLowerCase(),
        );
        if (isDuplicateUsername) {
            setError(
                `Username "${cleanUsername}" is already taken. Please choose another username.`,
            );
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        setIsSubmitting(true);
        const result = await addSupervisor({
            username: cleanUsername,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || "+61 400 000 000",
            semesterId: formData.semesterId,
            faculty: formData.faculty,
        });
        setIsSubmitting(false);
        if (!result.success) {
            setError(result.message || "Could not create supervisor.");
            return;
        }
        onClose();
    };

    return (
        <div
            id="add-supervisor-modal-backdrop"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
            <div
                id="add-supervisor-modal"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
                            <UserPlus className="w-4 h-4" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Add New Supervisor
                        </h2>
                    </div>
                    <button
                        id="close-add-supervisor-modal-btn"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body / Form */}
                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="p-6 space-y-4"
                >
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span>
                            A password will be generated automatically and emailed to the
                            supervisor together with their username.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Username */}
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Username *
                            </label>
                            <input
                                id="add-supervisor-username"
                                type="text"
                                required
                                placeholder="e.g. ivantrinh"
                                value={formData.username}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        username: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* First Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                First Name *
                            </label>
                            <input
                                id="add-supervisor-firstname"
                                type="text"
                                required
                                placeholder="e.g. Ivan"
                                value={formData.firstName}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        firstName: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Last Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Last Name *
                            </label>
                            <input
                                id="add-supervisor-lastname"
                                type="text"
                                required
                                placeholder="e.g. Trinh"
                                value={formData.lastName}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        lastName: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Email *
                            </label>
                            <input
                                id="add-supervisor-email"
                                type="email"
                                required
                                placeholder="e.g. ivan@swin.edu.au"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        email: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Phone
                            </label>
                            <input
                                id="add-supervisor-phone"
                                type="tel"
                                placeholder="e.g. +61 412 345 678"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        phone: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label htmlFor="add-supervisor-semester" className="block text-xs font-semibold mb-1">Semester *</label>
                            <select id="add-supervisor-semester" required value={formData.semesterId} onChange={e => setFormData({ ...formData, semesterId: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
                                <option value="">Select a semester</option>
                                {semesters.map(semester => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
                            </select>
                            {!semesters.length && <p className="text-xs text-amber-600 mt-2">Create an active semester before adding supervisors. <button type="button" className="underline" onClick={() => { setActiveAdminView('semesters'); onClose(); }}>Manage semesters</button></p>}
                        </div>
                    </div>

                    {/* Faculty (Selection) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Faculty *
                        </label>
                        <select
                            id="add-supervisor-faculty"
                            value={formData.faculty}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    faculty: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            {faculties.map((f) => (
                                <option key={f.id} value={f.name}>
                                    {f.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                        <button
                            id="cancel-add-supervisor-btn"
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            id="submit-add-supervisor-btn"
                            disabled={!semesters.length || isSubmitting}
                            type="submit"
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Creating & emailing..." : "Save Supervisor"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
