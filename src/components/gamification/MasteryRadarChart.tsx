"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface MasteryItem {
  slug: string;
  score: number;
}

export default function MasteryRadarChart({ masteryMap = [] }: { masteryMap?: MasteryItem[] }) {
  // Map masteryMap to chartData
  const chartData = (masteryMap || []).slice(0, 6).map(item => ({
    topic: item.slug.charAt(0).toUpperCase() + item.slug.slice(1).replace(/-/g, ' '),
    score: Math.round(item.score),
  }))

  const chartConfig = {
    score: {
      label: "Mastery Level",
      color: "#bbddff",
    },
  } satisfies ChartConfig

  return (
    <Card className="h-full border shadow-sm">
      <CardHeader className="items-center pb-4">
        <CardTitle>Topic Mastery</CardTitle>
        <CardDescription>
          Visualizing your skills across multiple domains
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-0 h-[300px]">
        {/* @ts-ignore */}
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-full"
        >
          {/* @ts-ignore */}
          <RadarChart data={chartData}>
            {/* @ts-ignore */}
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <PolarAngleAxis dataKey="topic" />
            <PolarGrid />
            <Radar
              dataKey="score"
              fill="#bbddff"
              fillOpacity={0.6}
              // @ts-ignore
              dot={{
                r: 4,
                fillOpacity: 1,
              }}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
