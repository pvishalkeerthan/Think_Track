"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface SavedDecksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDeck: (deck: any) => void;
  currentConfig?: any;
}

export default function SavedDecksDrawer({ isOpen, onClose, onLoadDeck, currentConfig }: SavedDecksDrawerProps) {
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/decks")
        .then((res) => res.json())
        .then((data) => {
          setDecks(data.decks || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSaveCurrent = async () => {
    if (!newDeckName.trim() || !currentConfig) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeckName,
          ...currentConfig
        })
      });
      const data = await res.json();
      if (data.success) {
        setDecks([...decks, data.deck]);
        setNewDeckName("");
      }
    } catch (err) {
      console.error(err);
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/decks?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDecks(decks.filter((d) => d._id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[400px] border-l bg-background shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Saved Decks</h2>
              <button onClick={onClose} className="p-2 rounded-md hover:bg-muted">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
              {currentConfig && (
                <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col gap-3">
                  <h3 className="font-medium text-sm text-card-foreground">Save Current Config</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Daily React Warmup"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveCurrent} 
                      disabled={isSaving || !newDeckName.trim()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 mt-4">
                <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wider">Your Decks ({decks.length})</h3>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : decks.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
                    No decks saved yet. Configure a quiz and save it for quick access later.
                  </p>
                ) : (
                  <AnimatePresence>
                    {decks.map(deck => (
                      <motion.div
                        key={deck._id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                        className="rounded-lg border bg-card p-4 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{deck.name}</h4>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize shrink-0
                            ${deck.difficulty === 'hard' ? 'bg-destructive/10 text-destructive' : ''}
                            ${deck.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-600' : ''}
                            ${deck.difficulty === 'easy' ? 'bg-green-500/10 text-green-600' : ''}
                          `}>
                            {deck.difficulty}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mb-4">
                          <p>Topic: <span className="text-foreground capitalize">{deck.topic.replace(/-/g, ' ')}</span></p>
                          <p>Questions: <span className="text-foreground">{deck.questionCount}</span></p>
                        </div>
                        <div className="flex justify-between gap-2">
                          <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => handleDelete(deck._id)}>
                            Delete
                          </Button>
                          <Button size="sm" className="w-full" onClick={() => onLoadDeck(deck)}>
                            Load Config
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
