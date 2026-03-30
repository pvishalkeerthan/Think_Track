"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ResultPage() {
  const { roomId } = useParams();
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [rank, setRank] = useState(null);
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch("/api/collab-test/get-room", {
          method: "POST",
          body: JSON.stringify({ roomId }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        const rawUsers = data.room.participants || [];
        
        // Calculate totalTime for each participant
        const users = rawUsers.map(p => ({
          ...p,
          totalTime: p.answers.reduce((acc, curr) => acc + (curr.timeSpent || 0), 0)
        }));

        // Sort by score DESC, time ASC
        users.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.totalTime - b.totalTime;
        });

        setParticipants(users);

        const resSession = await fetch("/api/auth/session");
        const sessionData = await resSession.json();
        const userId = sessionData.user._id;
        setCurrentUserId(userId);

        // Set rank and user stats
        const userIndex = users.findIndex((u) => u.userId === userId);
        setRank(userIndex + 1);
        setUserStats(users[userIndex]);
      } catch (err) {
        toast.error("Failed to load results");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [roomId]);

  const getRankEmoji = (position) => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground font-medium">Loading Results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Quiz Results</h1>
        <p className="text-muted-foreground">Final performance breakdown</p>
      </div>

      {userStats && (
        <Card className="mb-12 border shadow-sm overflow-hidden">
          <CardHeader className="text-center border-b bg-muted/30 py-8">
            <div className="text-5xl mb-4">{getRankEmoji(rank)}</div>
            <CardTitle className="text-2xl">Your Performance: Rank #{rank}</CardTitle>
          </CardHeader>
          <CardContent className="pt-10 pb-10">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div className="space-y-1">
                <div className="text-4xl font-bold text-primary">{userStats.score}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Accuracy</div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-bold text-primary">{userStats.totalTime || "0"}s</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Time Taken</div>
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-bold text-primary">#{rank}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Position</div>
              </div>
            </div>
            
            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button variant="default" className="w-full px-8">Go to Dashboard</Button>
              </Link>
              <Link href="/collab-test/join" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full px-8">Join Another Room</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <span>Leaderboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Participant</th>
                  <th className="px-6 py-4 text-center">Score</th>
                  <th className="px-6 py-4 text-center">Time (s)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {participants.map((participant, index) => {
                  const isCurrentUser = participant.userId === currentUserId;
                  const position = index + 1;

                  return (
                    <tr
                      key={participant.userId}
                      className={`transition-colors ${
                        isCurrentUser
                          ? "bg-primary/5 font-medium"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-lg w-6">{getRankEmoji(position)}</span>
                          <span className={isCurrentUser ? "text-primary font-bold" : "text-muted-foreground"}>
                            #{position}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {participant.name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <span className={isCurrentUser ? "text-primary font-bold" : "text-foreground"}>
                              {participant.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-bold">
                        {participant.score}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-muted-foreground">
                        {participant.totalTime || "-"}s
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center mt-12 bg-muted/30 p-4 rounded-lg border border-dashed">
        <p className="text-muted-foreground italic">Great job everyone! 🎉</p>
      </div>
    </div>
  );
}
