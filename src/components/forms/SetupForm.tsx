"use client";

import { useState, useRef } from "react";
import { setupProfileAction } from "@/actions/profile";
import type { ProfileFieldErrors } from "@/actions/profile";
import { validateEmail } from "@/lib/validators";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  profileImage: File | null;
};

// ─── SetupForm ────────────────────────────────────────────────────────────────

interface SetupFormProps {
  showProfileImage?: boolean;
}

/**
 * Client Component for new-user profile setup.
 * Fields: firstName, lastName, email, password, profileImage (optional).
 * On valid client-side submit → shows LiabilityDisclaimerModal.
 * "I acknowledge" triggers setupProfileAction server action.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */
export default function SetupForm({ showProfileImage = true }: SetupFormProps) {
  const [values, setValues] = useState<FormValues>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    profileImage: null,
  });

  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // ── Client-side validation ──────────────────────────────────────────────────

  function validateForm(): ProfileFieldErrors {
    const newErrors: ProfileFieldErrors = {};

    if (!values.firstName.trim()) {
      newErrors.firstName = "First name is required.";
    }
    if (!values.lastName.trim()) {
      newErrors.lastName = "Last name is required.";
    }
    if (!values.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!validateEmail(values.email.trim())) {
      newErrors.email =
        "Please enter a valid email address (e.g. name@example.com).";
    }
    if (!values.password) {
      (newErrors as Record<string, string>).password =
        "Password is required.";
    }

    return newErrors;
  }

  // ── Form submit handler (opens modal if valid) ──────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      setModalOpen(true);
    }
  }

  // ── Modal: "I acknowledge" → submit to server ──────────────────────────────

  async function handleAcknowledge() {
    setSubmitting(true);

    const formData = new FormData();
    formData.append("firstName", values.firstName.trim());
    formData.append("lastName", values.lastName.trim());
    formData.append("email", values.email.trim());
    formData.append("password", values.password);

    if (values.profileImage) {
      formData.append("profileImage", values.profileImage);
    }

    const result = await setupProfileAction(formData);

    if (!result.success) {
      setErrors(result.errors);
      setModalOpen(false);
      setSubmitting(false);
      // Return focus to form
      firstInputRef.current?.focus();
    }
    // On success, setupProfileAction redirects to /home
  }

  // ── Modal: "Cancel" → close modal, return focus ────────────────────────────

  function handleCancel() {
    setModalOpen(false);
    firstInputRef.current?.focus();
  }

  // ── Input change handlers ──────────────────────────────────────────────────

  function handleChange(field: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      if (field === "profileImage") {
        setValues((prev) => ({
          ...prev,
          profileImage: e.target.files?.[0] ?? null,
        }));
      } else {
        setValues((prev) => ({ ...prev, [field]: e.target.value }));
      }
      // Clear field error on change
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="w-full space-y-5"
        noValidate
      >
        {/* First Name */}
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            First name <span className="text-red-600">*</span>
          </label>
          <input
            ref={firstInputRef}
            id="firstName"
            name="firstName"
            type="text"
            value={values.firstName}
            onChange={handleChange("firstName")}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            className={`w-full min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.firstName ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.firstName && (
            <p id="firstName-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.firstName}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Last name <span className="text-red-600">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            value={values.lastName}
            onChange={handleChange("lastName")}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            className={`w-full min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.lastName ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.lastName && (
            <p id="lastName-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.lastName}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email <span className="text-red-600">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={handleChange("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`w-full min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password <span className="text-red-600">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={values.password}
            onChange={handleChange("password")}
            aria-invalid={!!(errors as Record<string, string>).password}
            aria-describedby={
              (errors as Record<string, string>).password
                ? "password-error"
                : undefined
            }
            className={`w-full min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              (errors as Record<string, string>).password
                ? "border-red-500"
                : "border-gray-300"
            }`}
          />
          {(errors as Record<string, string>).password && (
            <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
              {(errors as Record<string, string>).password}
            </p>
          )}
        </div>

        {/* Profile Image (optional) */}
        {showProfileImage && (
          <div>
            <label
              htmlFor="profileImage"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Profile image{" "}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              id="profileImage"
              name="profileImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleChange("profileImage")}
              aria-invalid={!!errors.profileImage}
              aria-describedby={
                errors.profileImage ? "profileImage-error" : undefined
              }
              className="w-full min-h-[44px] min-w-[44px] text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            {errors.profileImage && (
              <p
                id="profileImage-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.profileImage}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-600">
              JPEG, PNG, or WebP. Max 5 MB.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full min-h-[44px] min-w-[44px] rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={submitting}
        >
          {submitting ? "Submitting…" : "Complete setup"}
        </button>
      </form>

      {/* ── Liability Disclaimer Modal ──────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2
              id="disclaimer-title"
              className="text-lg font-semibold text-gray-900 mb-3"
            >
              Liability Disclaimer
            </h2>
            <p className="text-sm text-gray-700 mb-6 leading-relaxed">
              The travel advice provided by Travel Guide is generated by AI
              and is intended for informational purposes only. We do not
              guarantee the accuracy, completeness, or timeliness of any advice.
              Travel conditions change frequently. Always verify critical
              information with official sources before making travel decisions.
              By proceeding, you acknowledge that Travel Guide and its
              creators are not liable for any loss, injury, or inconvenience
              arising from the use of this information.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="min-h-[44px] min-w-[44px] rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={submitting}
                autoFocus
                className="min-h-[44px] min-w-[44px] rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : "I acknowledge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
