'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function CreateRoomPage() {
  const router = useRouter();
  const [tests, setTests] = useState([]);
  const [testId, setTestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingTests, setFetchingTests] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await fetch('/api/tests');
        const data = await res.json();
        setTests(data.tests || []);
      } catch (err) {
        toast.error('Failed to load available tests');
      } finally {
        setFetchingTests(false);
      }
    };

    fetchTests();
  }, []);

  const handleCreateRoom = async () => {
    if (!testId) {
      toast.error('Please select a test to create a room');
      return;
    }
    
    setLoading(true);

    try {
      const res = await fetch('/api/collab-test/create-room', {
        method: 'POST',
        body: JSON.stringify({ testId }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (data.roomCode) {
        toast.success(`Room created successfully! Code: ${data.roomCode}`);
        router.push(`/collab-test/${data.roomId}/lobby`);
      } else {
        toast.error(data.error || 'Failed to create room');
      }
    } catch (err) {
      toast.error('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingTests) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-xl px-6 py-20">
      <Card className="border shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Create Room</CardTitle>
          <CardDescription>Set up a collaborative quiz session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Select a Test</label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
              >
                <option value="">-- Choose a test --</option>
                {tests.map((test) => (
                  <option key={test._id} value={test._id}>
                    {test.title}
                  </option>
                ))}
              </select>
            </div>

            {tests.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
                No tests available. Please create some tests first.
              </div>
            )}

            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleCreateRoom} 
              disabled={loading || !testId || tests.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Room"
              )}
            </Button>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg border border-muted">
            <h3 className="font-semibold text-sm mb-2">How it works:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Select a test from your available quizzes</li>
              <li>• A unique room code will be generated</li>
              <li>• Share the code with participants</li>
              <li>• Start the quiz when everyone joins</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
