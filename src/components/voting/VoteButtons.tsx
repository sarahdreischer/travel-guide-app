"use client";

import { useState, useTransition } from "react";
import {
  castVoteAction,
  changeVoteAction,
  retractVoteAction,
  addExperienceNoteAction,
} from "@/actions/vote";

interface VoteButtonsProps {
  adviceId: string;
  currentVote: "accurate" | "outdated" | "none" | null;
  currentNote?: string | null;
}

export default function VoteButtons({
  adviceId,
  currentVote,
  currentNote,
}: VoteButtonsProps) {
  const [vote, setVote] = useState<"accurate" | "outdated" | "none" | null>(
    currentVote
  );
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState(currentNote ?? "");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasVote = vote === "accurate" || vote === "outdated";

  function handleVoteClick(voteType: "accurate" | "outdated") {
    startTransition(async () => {
      if (vote === voteType) {
        // Retract the current vote
        setVote("none");
        const result = await retractVoteAction(adviceId);
        if (!result.success) {
          // Revert optimistic update on failure
          setVote(voteType);
        }
      } else if (!hasVote) {
        // Cast a new vote (no existing vote)
        const previousVote = vote;
        setVote(voteType);
        const result = await castVoteAction(adviceId, voteType);
        if (!result.success) {
          setVote(previousVote);
        }
      } else {
        // Change from one vote type to the other
        const previousVote = vote;
        setVote(voteType);
        const result = await changeVoteAction(adviceId, voteType);
        if (!result.success) {
          setVote(previousVote);
        }
      }
    });
  }

  function handleAddExperience() {
    setShowNoteInput(true);
    setNoteError(null);
    setNoteSaved(false);
  }

  function handleCancelNote() {
    setShowNoteInput(false);
    setNoteText(currentNote ?? "");
    setNoteError(null);
  }

  function handleSubmitNote() {
    const trimmed = noteText.trim();

    if (trimmed.length === 0) {
      setNoteError("Experience note cannot be empty.");
      return;
    }

    if (trimmed.length > 500) {
      setNoteError("Experience note must be 500 characters or fewer.");
      return;
    }

    setNoteError(null);

    startTransition(async () => {
      const result = await addExperienceNoteAction(adviceId, trimmed);
      if (result.success) {
        setShowNoteInput(false);
        setNoteSaved(true);
      } else {
        setNoteError(result.error);
      }
    });
  }

  const charCount = noteText.length;
  const isOverLimit = charCount > 500;

  return (
    <div className="flex flex-col gap-3">
      {/* Vote buttons row */}
      <div className="flex flex-row items-center gap-2 flex-wrap">
        {/* Accurate button */}
        <button
          type="button"
          onClick={() => handleVoteClick("accurate")}
          disabled={isPending}
          aria-pressed={vote === "accurate"}
          aria-label="Vote accurate"
          className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            vote === "accurate"
              ? "bg-blue-100 border-blue-500 text-blue-700"
              : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
        >
          👍 Accurate
        </button>

        {/* Outdated button */}
        <button
          type="button"
          onClick={() => handleVoteClick("outdated")}
          disabled={isPending}
          aria-pressed={vote === "outdated"}
          aria-label="Vote outdated"
          className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            vote === "outdated"
              ? "bg-red-100 border-red-500 text-red-700"
              : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
          }`}
        >
          👎 Outdated
        </button>

        {/* Add experience button */}
        <button
          type="button"
          onClick={handleAddExperience}
          disabled={isPending}
          aria-label="Add experience"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➕ Add experience
        </button>
      </div>

      {/* Note saved confirmation */}
      {noteSaved && !showNoteInput && (
        <p className="text-sm text-green-600">Experience note saved.</p>
      )}

      {/* Inline note input */}
      {showNoteInput && (
        <div className="flex flex-col gap-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={500}
            placeholder="Share your experience (max 500 characters)..."
            aria-label="Experience note"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-y min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          {/* Character counter */}
          <p
            className={`text-sm ${
              isOverLimit ? "text-red-600" : "text-gray-600"
            }`}
          >
            {charCount}/500
          </p>

          {/* Error message */}
          {noteError && (
            <p className="text-sm text-red-600" role="alert">
              {noteError}
            </p>
          )}

          {/* Submit and Cancel buttons */}
          <div className="flex flex-row gap-2">
            <button
              type="button"
              onClick={handleSubmitNote}
              disabled={isPending || isOverLimit}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={handleCancelNote}
              disabled={isPending}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
