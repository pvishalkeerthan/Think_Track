"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

function LeaderboardContent() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalCount: 0 });
  const [myRank, setMyRank] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const view = searchParams.get("view") || "global";
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      const userIdParam = session?.user?.id ? `&userId=${session.user.id}` : "";
      const res = await fetch(
        `/api/leaderboard?view=${view}&page=${page}&limit=${limit}${userIdParam}`
      );
      const data = await res.json();
      setUsers(data.data || []);
      setPagination(data.pagination || { page, limit, totalCount: 0 });
      setMyRank(data.myRank ?? null);
      setLoading(false);
    };
    fetchData();
  }, [searchParams, session]);

  const totalPages = Math.ceil(pagination.totalCount / pagination.limit) || 1;
  const from = pagination.totalCount === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.totalCount);

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
      {myRank != null && (
        <div className="sticky top-0 z-10 mb-4 py-2 bg-background/80 backdrop-blur">
          Your rank: #{myRank}
        </div>
      )}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 text-xs text-gray-500 px-2">
            <div>Rank & User</div>
            <div className="text-center">🔥 Streak</div>
            <div className="text-right">Total XP</div>
          </div>
          {users.map((u, idx) => (
            <div
              key={u._id}
              className="rounded-xl p-4 border bg-white dark:bg-zinc-900 shadow-sm"
            >
              <div className="grid grid-cols-3 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 text-center font-bold">
                    {(pagination.page - 1) * pagination.limit + idx + 1}
                  </div>
                  <div className="font-semibold">
                    {u.name || (u.email ? u.email.split("@")[0] : "User")}
                  </div>
                </div>
                <div className="text-sm text-center">
                  🔥 {u.streak}
                </div>
                <div className="text-sm text-right font-semibold">
                  {u.totalXP} XP
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && pagination.totalCount > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {from}–{to} of {pagination.totalCount}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => {
                const view = searchParams.get("view") || "global";
                router.push(
                  `/leaderboard?view=${view}&page=${pagination.page - 1}&limit=${pagination.limit}`
                );
              }}
            >
              Prev
            </Button>
            <div className="flex items-center px-2 text-sm text-gray-600">
              Page {pagination.page} of {totalPages}
            </div>
            <Button
              variant="secondary"
              disabled={pagination.page >= totalPages}
              onClick={() => {
                const view = searchParams.get("view") || "global";
                router.push(
                  `/leaderboard?view=${view}&page=${pagination.page + 1}&limit=${pagination.limit}`
                );
              }}
            >
              Next
            </Button>
          </div>
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
