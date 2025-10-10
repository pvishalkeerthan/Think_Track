"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-hot-toast";

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
        const users = data.room.participants || [];

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
        return "🏅";
    }
  };

  const getRankColor = (position) => {
    switch (position) {
      case 1:
        return "from-yellow-400 to-yellow-600";
      case 2:
        return "from-gray-300 to-gray-500";
      case 3:
        return "from-orange-400 to-orange-600";
      default:
        return "from-blue-400 to-blue-600";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🏆 Quiz Results
          </h1>
          <p className="text-gray-600">See how everyone performed!</p>
        </div>

        {/* User's Performance Card */}
        {userStats && (
          <div
            className={`bg-gradient-to-r ${getRankColor(
              rank
            )} rounded-xl shadow-lg p-6 mb-8 text-white`}
          >
            <div className="text-center">
              <div className="text-6xl mb-2">{getRankEmoji(rank)}</div>
              <h2 className="text-2xl font-bold mb-2">Your Result</h2>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="bg-white/20 rounded-lg p-3">
                  <div className="text-2xl font-bold">{rank}</div>
                  <div className="text-sm opacity-90">Rank</div>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <div className="text-2xl font-bold">{userStats.score}</div>
                  <div className="text-sm opacity-90">Score</div>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <div className="text-2xl font-bold">
                    {userStats.totalTime || "0"}s
                  </div>
                  <div className="text-sm opacity-90">Time</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h2 className="text-xl font-bold text-gray-800">🏅 Leaderboard</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Time (s)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {participants.map((participant, index) => {
                  const isCurrentUser = participant.userId === currentUserId;
                  const position = index + 1;

                  return (
                    <tr
                      key={participant.userId}
                      className={`transition-colors duration-150 ${
                        isCurrentUser
                          ? "bg-green-50 border-l-4 border-green-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">
                            {getRankEmoji(position)}
                          </span>
                          <span
                            className={`text-lg font-bold ${
                              isCurrentUser ? "text-green-700" : "text-gray-700"
                            }`}
                          >
                            #{position}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                              isCurrentUser ? "bg-green-100" : "bg-gray-100"
                            }`}
                          >
                            <span
                              className={`font-semibold ${
                                isCurrentUser
                                  ? "text-green-700"
                                  : "text-gray-600"
                              }`}
                            >
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div
                              className={`font-medium ${
                                isCurrentUser
                                  ? "text-green-800"
                                  : "text-gray-800"
                              }`}
                            >
                              {participant.name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`text-xl font-bold ${
                            isCurrentUser ? "text-green-700" : "text-gray-700"
                          }`}
                        >
                          {participant.score}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`text-lg ${
                            isCurrentUser ? "text-green-600" : "text-gray-600"
                          }`}
                        >
                          {participant.totalTime || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Message */}
        <div className="text-center mt-8">
          <p className="text-gray-600">Great job everyone! 🎉</p>
        </div>
      </div>
    </div>
  );
}
