"use client";

import React from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { ModeToggle } from "./ui/toggle";
import { Button } from "./ui/button";

const Navbar = () => {
  const { data: session } = useSession();

  return (
    <nav className="flex justify-between items-center p-4 bg-white dark:bg-black sticky">
      <Link href="/">
        <div
          className="text-lg md:text-2xl m-4 font-bold text-center bg-clip-text text-transparent
          bg-gradient-to-b from-neutral-900 to-neutral-600 dark:from-neutral-50 dark:to-neutral-400 bg-opacity-50"
        >
          Think-Track
        </div>
      </Link>
      <div className="flex space-x-4 items-center">
        <ModeToggle />
        {session ? (
          <>
            <Link href="/doubts">
              <Button
                variant="outline"
                className="px-4 py-2 border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
              >
                Doubts
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button
                variant="outline"
                className="px-4 py-2 border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
              >
                Leaderboard
              </Button>
            </Link>
            <Link href="/ai-learning">
              <Button
                variant="outline"
                className="px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
              >
                AI Learning
              </Button>
            </Link>
            <Link href="/collab-test/join">
              <Button
                variant="outline"
                className="px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
              >
                Join Quiz
              </Button>
            </Link>
            <Button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="px-4 py-2 text-white bg-black dark:bg-white dark:text-black rounded hover:bg-red-700 transition"
            >
              Sign Out
            </Button>
          </>
        ) : (
          <></>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
