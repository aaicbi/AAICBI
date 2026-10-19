# Ads on the feed

A Super Admin books ads for organizations; they show on the public feed and the About page, always labelled **Sponsored** with the advertiser's logo and name.

- **Switches** (Platform > Ads): the master switch is off until turned on. A second switch (on by default) lets our own animated play card fill the top of the feed and the About page when no paid ad is running. Our card is never shown between posts.
- **Where**: top of the feed, one between posts after every 6 posts, and the About page. Shown to visitors and signed-in members alike.
- **An ad**: a picture (JPG/PNG/WebP/GIF, 5 MB) or video (MP4/WebM, 30 MB), headline (60), caption (140), button words (24) and an https link. Files go straight to storage through a signed upload; only files this app stored can be used. Dates are Nigerian time (first and last day inclusive).
- **Payment** is arranged outside the app and recorded: paid, unpaid or free. An unpaid ad is never shown or counted. Status: Live, Scheduled, Paused, Ended, Waiting for payment.
- **Serving**: least-shown ad first, so ads in the same place take turns. The public API never returns the advertiser's real link, price or notes; the button goes through `/api/public/ads/<id>/go`, which counts the tap and redirects only to the saved https link.
- **Counting**: a view is one ad on screen for a second (once per ad per day per browser, and capped at 20 a day per address); a tap is one open of the link (capped at 30 a day per address). Only live ads count.
- **Reports** (Insight > Ads report): views, taps and tap rate per ad for 7 days, 30 days or all time, with a CSV download. A Super Admin sees every ad; an organization sees only the ads booked for it.
- Every change is logged (scope `ADS`).

Tests: `tests/ads.test.ts` (rules), `scripts/device-checks/ads-feed.cjs` (end to end).
