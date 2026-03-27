"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function DoubtDetailPage({ params }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [doubt, setDoubt] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const fetchDoubt = async () => {
      setLoading(true);
      const res = await fetch(`/api/doubts/${params.id}`);
      const data = await res.json();
      setDoubt(data.data);
      setLoading(false);
    };
    fetchDoubt();
  }, [params.id]);

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/doubts/${params.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: answer }),
      });
      const data = await res.json();
      if (data.success) {
        setAnswer("");
        setDoubt(data.data);
      }
    } finally {
      setPosting(false);
    }
  };

  const upvote = async (answerId) => {
    const res = await fetch(`/api/doubts/${params.id}/upvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerId }),
    });
    const data = await res.json();
    if (data.success) {
      setDoubt((d) => ({
        ...d,
        answers: d.answers.map((a) =>
          a._id === answerId ? { ...a, upvotes: data.data.upvotes } : a
        ),
      }));
    }
  };

  const downvote = async (answerId) => {
    const res = await fetch(`/api/doubts/${params.id}/downvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerId }),
    });
    const data = await res.json();
    if (data.success) {
      setDoubt((d) => ({
        ...d,
        answers: d.answers.map((a) =>
          a._id === answerId ? { ...a, upvotes: data.data.upvotes } : a
        ),
      }));
    }
  };

  const upvoteDoubt = async () => {
    try {
      const res = await fetch(`/api/doubts/${params.id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setDoubt((d) => ({ ...d, totalUpvotes: data.data.upvotes }));
      } else {
        console.error("Upvote doubt failed:", data.error || data);
      }
    } catch (e) {
      console.error("Upvote doubt exception:", e);
    }
  };

  if (loading || !doubt) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const sortedAnswers = [...(doubt.answers || [])].sort(
    (a, b) => b.upvotes - a.upvotes
  );

  return (
    <div className="container mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button variant="secondary" onClick={() => router.push("/doubts")}>
          Back to doubts
        </Button>
        <Button
          variant="secondary"
          onClick={upvoteDoubt}
          className="whitespace-nowrap"
        >
          Upvote ({doubt.totalUpvotes})
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-2">Doubt</h1>
      <div className="bg-white text-black dark:bg-zinc-900 dark:text-white rounded-xl p-4 mb-4">
        <div className="text-sm text-gray-500">
          {new Date(doubt.createdAt).toLocaleString()}
        </div>
        <div className="font-semibold mt-2">{doubt.questionText}</div>
        {doubt.userAnswer && (
          <div className="text-sm mt-2">
            Your answer:{" "}
            <span className="font-semibold">{doubt.userAnswer}</span>
          </div>
        )}
        {doubt.correctAnswer && (
          <div className="text-sm">
            Correct answer:{" "}
            <span className="font-semibold">{doubt.correctAnswer}</span>
          </div>
        )}
        {doubt.confusion && (
          <div className="text-sm mt-2">Confusion: {doubt.confusion}</div>
        )}
      </div>

      <div className="bg-white text-black dark:bg-zinc-900 dark:text-white rounded-xl p-4 mb-4">
        <div className="text-sm text-gray-500 mb-1">
          AI Mentor {doubt.aiAnswerPending ? "(generating...)" : ""}
        </div>
        <div className="whitespace-pre-wrap">
          {doubt.aiAnswer || "No AI response yet."}
        </div>
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                console.log("[Client] Regenerating AI answer for", params.id);
                const res = await fetch(`/api/doubts/${params.id}/regenerate`, {
                  method: "POST",
                });
                const data = await res.json();
                if (data.success) {
                  setDoubt((d) => ({ ...d, aiAnswer: data.data.aiAnswer }));
                  console.log(
                    "[Client] Regenerate success, length:",
                    data.data.aiAnswer?.length || 0
                  );
                } else {
                  console.error("[Client] Regenerate failed:", data.error);
                }
              } catch (e) {
                console.error("[Client] Regenerate exception:", e);
              }
            }}
          >
            Regenerate AI answer
          </Button>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-2">Peer Answers</h2>
      <div className="space-y-3 mb-6">
        {sortedAnswers.length === 0 ? (
          <div className="text-sm text-gray-500">
            No answers yet. Be the first to help!
          </div>
        ) : (
          sortedAnswers.map((a) => (
            <div
              key={a._id}
              className="bg-white text-black dark:bg-zinc-900 dark:text-white rounded-xl p-4"
            >
              <div className="text-sm mb-2">{a.content}</div>
              <div className="flex items-center gap-4 text-sm">
                <button className="underline" onClick={() => upvote(a._id)}>
                  Upvote ({a.upvotes})
                </button>
                <button
                  className="underline text-red-600"
                  onClick={() => downvote(a._id)}
                >
                  Downvote
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-white text-black dark:bg-zinc-900 dark:text-white rounded-xl p-4">
        <h3 className="font-semibold mb-2">Write an answer</h3>
        <textarea
          className="w-full p-3 rounded border dark:bg-zinc-800"
          rows={4}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Explain clearly and helpfully..."
        />
        <div className="mt-3">
          <Button onClick={submitAnswer} disabled={posting}>
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Post Answer"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
