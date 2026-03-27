"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function JoinRoomPage() {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      toast.error('Please enter a room code');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/collab-test/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Successfully joined the room!');
        router.push(`/collab-test/${data.roomId}/lobby`);
      } else {
        toast.error(data.error || 'Failed to join room');
      }
    } catch (err) {
      toast.error('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-xl px-6 py-20">
      <Card className="border shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Join Room</CardTitle>
          <CardDescription>Enter the room code to join a collaborative quiz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Room Code</label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="ABC123"
                className="text-center text-2xl tracking-widest font-bold h-14"
                maxLength={6}
              />
            </div>
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleJoin} 
              disabled={loading || !roomCode.trim()}
            >
              {loading ? "Joining..." : "Join Room"}
            </Button>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg border border-muted">
            <h3 className="font-semibold text-sm mb-2">Instructions</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Ask the host for the 6-character room code</li>
              <li>• Ensure you have a stable internet connection</li>
              <li>• Join before the session host starts the quiz</li>
            </ul>
          </div>

          <div className="pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-3">Don't have a room code?</p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/collab-test/create')}>
              Create Your Own Room
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}