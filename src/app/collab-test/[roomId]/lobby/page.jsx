'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, Home, Play, Timer } from "lucide-react";

export default function LobbyPage() {
  const { roomId } = useParams();
  const router = useRouter();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/collab-test/room/${roomId}`);
        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setRoom(data.room);
        setIsHost(data.isHost);
      } catch (err) {
        toast.error("Failed to load room");
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
  }, [roomId]);

  useEffect(() => {
    if (!room) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/collab-test/room/${roomId}`);
        const data = await res.json();

        if (data?.room?.status === 'active') {
          toast.success("Quiz is starting!");
          router.push(`/collab-test/${roomId}/quiz`);
        }
        
        // Update participants in real-time
        if (data?.room?.participants) {
          setRoom(prevRoom => ({
            ...prevRoom,
            participants: data.room.participants
          }));
        }
      } catch (err) {
        // Silent fail for polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [roomId, router, room]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/collab-test/get-room`, {
        method: 'POST',
        body: JSON.stringify({ roomId }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Starting quiz for all participants!");
        router.push(`/collab-test/${roomId}/quiz`);
      } else {
        toast.error(data.error || 'Failed to start test');
      }
    } catch (error) {
      toast.error("Failed to start test. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20 text-center">
        <div className="text-destructive text-5xl mb-4">❌</div>
        <p className="text-muted-foreground font-medium">Room not found or failed to load.</p>
        <Button className="mt-4" onClick={() => router.push('/collab-test/join')}>Back to Join</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-6 py-12">
      {/* Room Header */}
      <Card className="mb-6 border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 border">
            <Home className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold">Room: {room.roomCode}</CardTitle>
          <CardDescription>Waiting for participants to join...</CardDescription>
        </CardHeader>
      </Card>

      {/* Participants List */}
      <Card className="mb-6 border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="w-5 h-5" />
            Participants ({room.participants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {room.participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No participants yet
            </div>
          ) : (
            <div className="grid gap-2">
              {room.participants.map((participant, idx) => (
                <div
                  key={idx}
                  className="flex items-center p-3 bg-muted/30 rounded-lg border gap-3"
                >
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border font-bold text-xs">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{participant.name}</span>
                  {isHost && idx === 0 && (
                    <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 bg-primary text-primary-foreground rounded">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Section */}
      <Card className="border shadow-sm">
        <CardContent className="pt-6 text-center">
          {isHost ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ready to begin? Make sure all participants have joined.
              </p>
              <Button
                onClick={handleStart}
                disabled={starting || room.participants.length === 0}
                className="w-full h-12 text-lg"
              >
                {starting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Quiz
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="mx-auto w-12 h-12 flex items-center justify-center">
                <Timer className="w-8 h-8 animate-pulse text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">
                Waiting for the host to start the quiz...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}