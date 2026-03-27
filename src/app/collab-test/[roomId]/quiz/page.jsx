"use client";

import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function QuizPage() {
  const { roomId } = useParams();
  const router = useRouter();

  const [room, setRoom] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch("/api/collab-test/get-room", {
          method: "POST",
          body: JSON.stringify({ roomId }),
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();
        setRoom(data.room);
      } catch (err) {
        toast.error("Failed to load quiz room");
      } finally {
        setLoading(false);
        setStartTime(Date.now());
      }
    };

    fetchRoom();
  }, [roomId]);

  const handleSubmitAnswer = async () => {
    if (!selected) {
      toast.error("Please select an option before submitting");
      return;
    }

    setSubmitting(true);
    const question = room.questions[currentQ];
    const isCorrect = selected === question.correctAnswer;
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    try {
      await fetch("/api/collab-test/submit-answer", {
        method: "POST",
        body: JSON.stringify({
          roomId,
          questionIndex: currentQ,
          userAnswer: selected,
          isCorrect,
          timeSpent,
        }),
      });

      setAnswers([
        ...answers,
        { questionIndex: currentQ, selected, isCorrect, timeSpent },
      ]);

      setSelected("");
      setCurrentQ((prev) => prev + 1);
      setStartTime(Date.now());

      // Remove individual answer feedback toasts - only show final completion message
    } catch (err) {
      toast.error("Failed to submit answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    try {
      await fetch("/api/collab-test/complete-test", {
        method: "POST",
        body: JSON.stringify({ roomId }),
      });
      toast.success("Quiz completed successfully!");
      router.push(`/collab-test/${roomId}/result`);
    } catch (err) {
      toast.error("Failed to complete quiz");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!room || !room.questions?.length) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20 text-center">
        <Card className="border shadow-sm p-8 flex flex-col items-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <p className="text-muted-foreground font-medium">No questions found for this quiz.</p>
          <Button className="mt-4" onClick={() => router.push('/collab-test/join')}>Back</Button>
        </Card>
      </div>
    );
  }

  // If all questions are answered, show completion before accessing current question
  if (currentQ >= room.questions.length) {
    return (
      <div className="container mx-auto max-w-md px-6 py-20 text-center">
        <Card className="border shadow-sm p-8 flex flex-col items-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
          <CardTitle className="text-2xl font-bold mb-4 text-foreground">Quiz Complete!</CardTitle>
          <CardDescription className="mb-6">Great job! You've answered all questions.</CardDescription>
          <Button className="w-full h-12 text-lg" onClick={handleFinish}>
            View Results
          </Button>
        </Card>
      </div>
    );
  }

  const question = room.questions[currentQ];
  const progress = (currentQ / room.questions.length) * 100;

  // Removed noisy debug logging

  // Safety check - if question doesn't exist or is malformed
  if (!question || !question.text) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20 text-center">
        <Card className="border shadow-sm p-8 flex flex-col items-center border-destructive">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <p className="text-muted-foreground font-medium">Question data is missing or corrupted.</p>
          <p className="text-xs text-muted-foreground mt-2">Please try refreshing or contact support.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      {/* Progress Header */}
      <Card className="mb-6 border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-xl font-bold">
              Question {currentQ + 1} of {room.questions.length}
            </CardTitle>
            <span className="text-xs font-bold bg-muted px-2 py-1 rounded border">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </CardHeader>
      </Card>

      {/* Question Card */}
      <Card className="border shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold leading-relaxed">
            {question.text}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            {question.options.map((option, idx) => (
              <label
                key={idx}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  selected === option
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={option}
                  checked={selected === option}
                  onChange={(e) => setSelected(e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${
                    selected === option
                      ? "border-primary-foreground bg-primary"
                      : "border-muted-foreground/30 bg-muted"
                  }`}
                >
                  {selected === option && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                  )}
                </div>
                <span className={`font-medium ${selected === option ? "text-primary font-bold" : "text-foreground"}`}>
                  {option}
                </span>
              </label>
            ))}
          </div>

          <Button
            onClick={handleSubmitAnswer}
            disabled={submitting || !selected}
            className="w-full h-12 text-lg"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Answer"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
