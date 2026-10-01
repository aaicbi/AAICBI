"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { Radio } from "lucide-react";

interface LiveActivityDto {
  windowMinutes: number;
  activeTrainees: number;
  activeVisitors: number;
  viewingCourses: number;
  takingAssessments: number;
  usingLoop: number;
}

/**
 * Analytics System Phase 5 — "LIVE PLATFORM ACTIVITY." Polls
 * independently of the main /admin/analytics dashboard's own day-
 * selector-driven fetch, every 20 seconds — shorter than
 * NotificationBell's 60s (src/components/NotificationBell.tsx) since
 * this section is explicitly meant to read as closer to live, same
 * plain useEffect/setInterval mechanism, no new infrastructure. Small,
 * honest numbers at this platform's real traffic — never padded.
 */
export default function LiveActivityCard() {
  const [activity, setActivity] = useState<LiveActivityDto | null>(null);

  function load() {
    fetch("/api/admin/analytics/live")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setActivity)
      .catch(() => {}); // a missed poll just means the next one tries again
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, []);

  if (!activity) return null;

  const stats: Array<[string, number]> = [
    ["Active trainees", activity.activeTrainees],
    ["Active visitors", activity.activeVisitors],
    ["Viewing a course", activity.viewingCourses],
    ["Taking an assessment", activity.takingAssessments],
    ["Using Ask Loop", activity.usingLoop],
  ];

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-teal opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-teal" />
        </span>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
          <Icon icon={Radio} size="sm" /> Live Activity
        </p>
        <span className="text-xs text-gray-400">last {activity.windowMinutes} minutes</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="font-display text-xl font-semibold text-brand-ink">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
