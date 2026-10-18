"use client";
import { useCallback, useEffect, useState } from "react";
import ArenaFrame from "./ArenaFrame";
import ArenaChat from "./ArenaChat";
import PushNudge from "./PushNudge";
import { useArenaLive, channels } from "./useArenaLive";
import type { CourseArenaView } from "@/lib/arena/arenaView";

/** The course chat on its own page: the place a push notification and the course page's chat button open. */
export default function ArenaChatPage({ courseId, traineeId }: { courseId: string; traineeId: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const { data: v, error, reload } = useArenaLive<CourseArenaView>(`/api/arena/courses/${courseId}`, { listen: [channels.course(courseId), channels.user(traineeId)], pollMs: 2000 });
  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }, []);
  const back = `/trainee/courses/${courseId}`;
  const newest = v?.chat.messages[v.chat.messages.length - 1]?.id;
  useEffect(() => { if (newest !== undefined) void fetch(`/api/arena/courses/${courseId}/chat/read`, { method: "POST" }).catch(() => undefined); }, [courseId, newest]);

  if (!v) return <ArenaFrame title="Course chat" backHref={back}><div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>{error ? error.message : "Opening the chat…"}</div></div></ArenaFrame>;
  const sus = v.suspension ? `You're suspended from the arena${v.suspension.until ? ` until ${new Date(v.suspension.until).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}${v.suspension.reason ? `: ${v.suspension.reason}` : "."}` : null;
  return (
    <ArenaFrame title={`${v.course.title} · Chat`} backHref={back}>
      <div className="ar-stage">
        <div className="ar-in ar-chatpage">
          <div className="ar-top"><div className="ar-t">Ayakbi Arena · chat</div><a className="ar-pill ar-gold" href={`/trainee/arena/${courseId}`}>Open the arena</a></div>
          <PushNudge />
          {v.chat.enabled
            ? <ArenaChat courseId={courseId} chat={v.chat} suspended={sus} online={v.online} offline={v.offline} busy={!!v.active || !!sus} onChanged={() => void reload()} flash={flash} big />
            : <div className="ar-glass"><p className="ar-muted">The course chat isn't open for this course yet.</p></div>}
        </div>
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}
