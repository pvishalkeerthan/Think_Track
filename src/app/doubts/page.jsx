"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSearchParams, useRouter } from "next/navigation";

function DoubtsContent() {
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const fetchDoubts = async () => {
      setLoading(true);
      const sort = searchParams.get("sort") || "recent";
      const res = await fetch(`/api/doubts?sort=${sort}`);
      const data = await res.json();
      setDoubts(data.data || []);
      setLoading(false);
    };
    fetchDoubts();
  }, [searchParams]);

  return (
    <div className="container mx-auto max-w-4xl px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Doubts Forum</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push("/doubts?sort=recent")}
          >
            Recent
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/doubts?sort=trending")}
          >
            Trending
          </Button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : doubts.length === 0 ? (
        <p>No doubts yet. Be the first to ask from your test results!</p>
        ) : (
        <div className="space-y-4">
          {doubts.map((d) => (
            <Link key={d._id} href={`/doubts/${d._id}`} className="block">
              <div className="bg-white text-black dark:bg-zinc-900 dark:text-white shadow rounded-xl p-5 hover:shadow-md transition border dark:border-zinc-800">
                <div className="text-sm text-gray-500">
                  {new Date(d.createdAt).toLocaleString()}
                </div>
                <div className="font-semibold mt-2">{d.questionText}</div>
                <div className="text-sm mt-3 line-clamp-2">
                  AI: {d.aiAnswer?.slice(0, 160) || "(No AI response)"}
                </div>
                <div className="text-xs mt-3">
                  Upvotes: {d.totalUpvotes} • Answers: {d.answers?.length || 0}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DoubtsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading doubts...</div>}>
      <DoubtsContent />
    </Suspense>
  );
}
