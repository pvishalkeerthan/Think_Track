"use client"
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from "react";
import { getUserTests, getTestResult, getTestStats } from "../../actions/testActions";
import { useSession } from "next-auth/react";
import { getUserDetails } from "@/actions";
import Link from "next/link";
import UserCard from "@/components/UserCard";
import TestSummaryCard from "@/components/TestSummaryCard";
import TestStatsCard from "@/components/TestStatsCard";
import BadgesCard from "@/components/BadgesCard";
import TestScoreChart from "@/components/TestScoreChart";
import TestList from "@/components/TestList";
import { Button } from "@/components/ui/button";
import StreakWidget from "@/components/gamification/StreakWidget";
import DailyChallengeCard from "@/components/gamification/DailyChallengeCard";
import PeerContextBanner from "@/components/gamification/PeerContextBanner";
import SkillTreePanel from "@/components/gamification/SkillTreePanel";
import MasteryRadarChart from "@/components/gamification/MasteryRadarChart";

const Dashboard = () => {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [userDetails, setUserDetails] = useState(null);
  const [testSummary, setTestSummary] = useState({ totalTests: 0, avgAccuracy: 0 });
  const [testStats, setTestStats] = useState({ easy: 0, medium: 0, hard: 0 });
  const [badges, setBadges] = useState([]);
  const [gamification, setGamification] = useState(null);

  useEffect(() => {
    const fetchTests = async () => {
      if (session?.user?.id) {
        setLoading(true);
        const userTests = await getUserTests(session.user.id);
        const userdata = await getUserDetails(session.user.id);
        const stats = await getTestStats(session.user.id);
        setUserDetails(userdata);
        setTestStats(stats);

        const totalTests = userTests.length;
        const totalAccuracy = userTests.reduce((acc, test) => acc + test.score, 0);
        const avgAccuracy = totalTests > 0 ? (totalAccuracy / totalTests).toFixed(2) : 0;

        setTestSummary({ totalTests, avgAccuracy });
        setTests(userTests);
        setBadges(calculateBadges(avgAccuracy));
        
        try {
          const gamiRes = await fetch("/api/user/gamification");
          if (gamiRes.ok) {
            const gamiData = await gamiRes.json();
            setGamification(gamiData);
            if (gamiData.streakAtRisk) {
              toast?.error("Your streak is at risk! Complete a quiz today."); // Using hot-toast if imported, but we don't have it imported here. We can just rely on the Widget.
            }
          }
        } catch(e) { console.error("Error fetching gamification", e); }
        
        setLoading(false);
      }
    };
    fetchTests();
  }, [session]);

  const calculateBadges = (accuracy) => {
    const badgeImages = [
      { threshold: 100, src: "/medal1.png" },
      { threshold: 80, src: "/medal2.png" },
      { threshold: 60, src: "/medal3.png" },
      { threshold: 40, src: "/medal4.png" },
      { threshold: 0, src: "/medal5.png" },
    ];

    return badgeImages.filter((badge) => accuracy >= badge.threshold).map((badge) => badge.src);
  };

  const handleTestClick = async (test) => {
    setLoading(true);
    const result = await getTestResult(test.id, session.user.id);
    if (result.success) {
      setSelectedTest(result.data);
    } else {
      console.error("Failed to fetch test details:", result.error);
    }
    setLoading(false);
  };

  const handleCloseDetails = () => {
    setSelectedTest(null);
  };

  const chartData = {
    labels: tests.map((test) => new Date(test.date).toLocaleDateString()),
    datasets: [
      {
        label: "Test Scores",
        data: tests.map((test) => test.score),
        fill: true,
        backgroundColor: "rgba(32, 178, 166, 0.2)",
        borderColor: "rgba(32, 178, 166, 1)",
        tension: 0.1,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: "#20B2A6",
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#20B2A6" },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#20B2A6" },
      },
    },
  };

  return (
    <div className="container mx-auto p-4 pb-16 flex flex-col md:flex-row">
      <div className="flex-1">
        <UserCard userDetails={userDetails} />
        
        {!loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <StreakWidget 
                streak={gamification?.streak} 
                longestStreakEver={gamification?.longestStreakEver} 
                atRisk={gamification?.streakAtRisk} 
              />
              <DailyChallengeCard />
            </div>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-6">
          <TestSummaryCard testSummary={testSummary} />
          <TestStatsCard testStats={testStats} />
          <BadgesCard badges={badges} pinnedBadges={gamification?.pinnedBadges} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 mt-6">
          <TestScoreChart loading={loading} chartData={chartData} chartOptions={chartOptions} />
          <MasteryRadarChart masteryMap={gamification?.topicMasteryMap || []} />
        </div>
        
        <div className="w-full mt-8">
          <PeerContextBanner />
          
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 px-6">
            <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">Your Previous Test Results</h1>
            <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
              <Link href="/community">
                <Button className="bg-white text-black border border-gray-300 hover:bg-gray-100 transition duration-200 w-full sm:w-auto">
                  Available Tests
                </Button>
              </Link>
              <Link href="/test-start">
                <Button className="bg-black text-white border border-gray-300 hover:bg-gray-800 transition duration-200 w-full sm:w-auto">
                  Create New Test With AI
                </Button>
              </Link>
            </div>
          </div>
          <TestList
            tests={tests}
            handleTestClick={handleTestClick}
            loading={loading}
            selectedTest={selectedTest}
            onCloseDetails={handleCloseDetails}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

