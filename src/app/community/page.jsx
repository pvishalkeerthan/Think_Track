"use client"
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getAllTests } from "@/actions/testActions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react"; // Import Loader2

const CommunityPage = () => {
  const [tests, setTests] = useState([]);
  const [communityTests, setCommunityTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const [fetchedTests, communityRes] = await Promise.all([
          getAllTests(),
          fetch("/api/community/questions?approved=true")
        ]);
        
        setTests(fetchedTests);
        
        if (communityRes.ok) {
          const communityData = await communityRes.json();
          // Group by topic
          const topics = {};
          communityData.data.forEach(q => {
            if (!topics[q.topic]) topics[q.topic] = 0;
            topics[q.topic]++;
          });
          
          setCommunityTests(Object.entries(topics).map(([topic, count]) => ({
            id: `community-${topic}`,
            title: `Community: ${topic.replace(/-/g, ' ')}`,
            description: `Curated collection of ${count} questions contributed by the community.`,
            duration: count * 2,
            numQuestions: count,
            difficulty: "medium",
            isCommunity: true
          })));
        }
      } catch (error) {
        console.error("Error fetching tests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 relative">
      <Link href="/dashboard" className="absolute top-4 right-4 px-6">
        <Button variant="secondary" className="bg-black text-white dark:bg-white dark:text-black">
          Back to Dashboard
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-6 px-6">Available Tests</h1>
      {tests.length === 0 ? (
        <p>No tests available at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 px-6 lg:grid-cols-3 gap-6">
          {[...tests, ...communityTests].map((test) => (
            <div
              key={test._id || test.id}
              className="bg-white dark:bg-zinc-900 dark:text-white  shadow-md rounded-lg p-6 relative"
            >
              {test.isCommunity && (
                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200">
                  Community
                </span>
              )}
              <h2 className="text-xl font-semibold mb-2">{test.title}</h2>
              <p className="text-gray-600 mb-4 line-clamp-2">{test.description}</p>
              <p className="text-sm text-gray-500 mb-2">
                Duration: {test.duration} minutes
              </p>
              <p>Questions: {test.numQuestions}</p>
              <p className="text-sm text-gray-500 mb-4">
                Difficulty: {test.difficulty}
              </p>
              <Link href={test.isCommunity ? `/test/${test.id}` : `/test/${test._id}`}>
                <Button variant="primary" className="w-full h-12 bg-black text-white dark:bg-white dark:text-black text-lg">
                  Take Test
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityPage;

