
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const UserCard = ({ userDetails }) => (
  <Card className="shadow-lg w-full dark:border-0 dark:bg-zinc-900 text-center">
    <CardHeader>
      <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
        {userDetails ? `${userDetails.name}'s Dashboard` : "Loading..."}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-lg font-medium dark:text-white">{userDetails?.name || "N/A"}</p>
      <p className="dark:text-gray-300">{userDetails?.email || "N/A"}</p>
      <p className="dark:text-gray-300 mb-4">{userDetails?.role || "N/A"}</p>
      
      <Link href="/profile/contribute">
        <Button variant="outline" size="sm" className="text-xs">
          Contribute a question →
        </Button>
      </Link>
    </CardContent>
  </Card>
);

export default UserCard;
