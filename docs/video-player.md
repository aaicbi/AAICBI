# Video player

YouTube videos on the platform are played with YouTube's official player interface (`src/lib/video/youtubeApi.ts`) with YouTube's own controls switched off (`playerVars` in `src/lib/video/embed.ts`: no control bar, no full-screen button, inline on phones, no annotations, related videos only from the same channel). The frame cannot be clicked, so none of YouTube's buttons can be reached. The platform draws its own controls on top (`src/components/video/ControlledYouTube.tsx`): tap the video to play or pause, a raised speaker button (bottom right) for sound, a thin progress bar you can tap to seek, and a full screen button (opens the large view, which works on phones too).

**Limit.** YouTube's rules do not allow hiding or cropping its branding, and the platform does not try to. YouTube may still show its small mark or the video's title when a video loads or is paused. The only way to have no YouTube anywhere is to host the video file ourselves (not done; Google Drive videos keep Drive's own player).

## Autoplay while scrolling (feed and post pages)
`PostCard` with `autoplay` (used by `PostItem`, so the feed, search, profiles, saved posts and each post's page) turns on `autoplayInView` in `VideoPlayer`:
- The video that is most on screen (at least 55% in view) plays by itself, **muted**, so phones allow it. Which one is decided in `src/lib/video/activeVideo.ts` (tested), watched by `src/lib/video/activity.ts`. Only one plays at a time; the one already playing keeps going until another is clearly more in view.
- It **grows** from slightly inset to the full width of its card while it plays, and settles back after.
- Scrolling on to another video **pauses** the first and plays the next. Coming back resumes. Tapping to pause keeps it paused until you leave and return. Hiding the tab pauses it. Opening full screen pauses the one underneath.
- Once someone turns the sound on, later videos start with sound for the rest of the visit (`src/lib/video/sound.ts`). If a browser refuses sound without a tap, it falls back to muted.
- No autoplay for people with reduced motion set on their device, with data saver on, or in the platform's low-bandwidth mode; they tap to play.
- Course lessons keep tap to play (learners expect to control those), but use the same controls without YouTube's.

Checks: `tests/activeVideo.test.ts` and `scripts/device-checks/video-autoplay.cjs` (real browser, with a stand-in for YouTube's player interface because YouTube is not reachable from the test setup).
