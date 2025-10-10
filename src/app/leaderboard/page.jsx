"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";

function LeaderboardContent() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const view = searchParams.get("view") || "global";
      const res = await fetch(`/api/leaderboard?view=${view}`);
      const data = await res.json();
      setUsers(data.data || []);
      setLoading(false);
    };
    fetchData();
  }, [searchParams]);

  return (
    <div className="container mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push("/leaderboard?view=global")}
          >
            Global
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/leaderboard?view=streak")}
          >
            Streaks
          </Button>
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 text-xs text-gray-500 px-2">
            <div>Rank & User</div>
            <div className="text-center">Level & Streak</div>
            <div className="text-right">Total XP</div>
          </div>
          {users.map((u, idx) => (
            <div
              key={u._id}
              className={`rounded-xl p-4 ${
                idx === 0
                  ? "bg-yellow-100 dark:bg-yellow-900/20"
                  : idx === 1
                  ? "bg-gray-100 dark:bg-gray-800"
                  : idx === 2
                  ? "bg-amber-50 dark:bg-amber-900/10"
                  : "bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="grid grid-cols-3 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 text-center font-bold">{idx + 1}</div>
                  <div className="font-semibold">
                    {u.name || (u.email ? u.email.split("@")[0] : "User")}
                  </div>
                </div>
                <div className="text-sm text-center">
                  Lv {u.level} • 🔥 {u.streak}
                </div>
                <div className="text-sm text-right font-semibold">
                  {u.totalXP} XP
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading leaderboard...</div>}>
      <LeaderboardContent />
    </Suspense>
  );
}
