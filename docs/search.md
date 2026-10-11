# Search (phase 4)

One search, `/search`, and quick suggestions in the header box. It extends the platform's existing search; there is no second system.

## What it finds
People, Organizations, Employers, Investors, Startups, Jobs, Programs, Posts, Videos and Events. "All" shows a short preview of each kind; choosing a kind shows its full list. Everything is read by the same public, approved and visibility rules as the page a result opens:

| Kind | Rule |
|---|---|
| People | A member's own visibility setting (public, or members only for a signed-in viewer), verified email. A private profile is never found, not even by a signed-in member. |
| Organizations | Approved, public page switched on. |
| Employers | Approved, and the employer's own visibility setting (public, members only, private). |
| Investors | **Investors have no public profile yet**, so only the investor and AAICBI staff can find one. The page says so instead of showing nothing. |
| Startups | Approved only. A draft, pending or suspended startup is never found. |
| Jobs | The public job board's rule: approved, not past the closing date, approved employer. Pending and expired postings are never found. |
| Programs | Published courses of organizations with a public page. |
| Posts | Published, not blocked by the organization, public (or members-only for a signed-in viewer). |
| Videos, Events | The earlier public rules. |

Each kind also respects its feature switch in the ecosystem settings (jobs, the trainee directory, the feed, organization pages, education).

## Words, filters, sort, paging
- A word (2 to 80 characters), a filter, or both. A filter alone works: `?kind=people&skill=python`. With a kind chosen and nothing typed, the newest of that kind are listed.
- Filters belong to a kind: people (skill, location), organizations (location), startups (industry, location), jobs (skill), programs (category), posts (type: text, images, video). Jobs have no location because a posting does not record one.
- Names, handles (also a former handle), tagline, location, skills, industry and what a startup or organization says about itself are matched. Marks on letters do not get in the way ("Ola" finds "Ọla").
- Ranking: an exact name, then a name that starts with the word, then the word inside a name, then a match in another field; ties go to the newest. "Newest" sorts by date only.
- Twelve results a page with Previous and Next; every address holds the whole request, so a search can be shared or reloaded.

## Suggestions as you type
`GET /api/search/suggest?q=` returns up to eight suggestions (people, organizations, startups, employers, jobs, programs, skills) after two letters, with a 200 ms pause. The box is a proper combobox: arrow keys, Enter, Escape, a spinner, and "See all results". It returns only a label, a kind, a short description and an address, never an email or anything private, and is limited to 120 requests a minute per address. A failure shows no suggestions rather than an error.

## States
Loading (a skeleton the shape of the results), an error page with "Try again", an empty state with guidance (check spelling, remove a filter, search everything, browse organizations, jobs or startups), and "type at least two letters" before anything is asked.

## Safety
Text from the address is escaped, lengths and page numbers are capped, unknown kinds and sorts fall back to defaults, and nothing in a query is built by joining strings.

## Not done
- **Employers and investors by industry or skill**: they record neither.
- **Search by project or portfolio item** is not separate; a member's skills, place and name are searched, and their posts are searchable as posts.
- **Database indexes** for text search are created by the automatic migration `20261025090000_search_indexes`, which is built never to fail or block a deploy (if the database does not allow the `pg_trgm` extension, it skips and logs a notice); see `docs/search-indexes.sql` to check and retry as an administrator. They are not declared in `schema.prisma`, so `prisma migrate dev` may offer to drop them: decline. At today's size the plain queries are fast (a suggestion answers in about 30 ms in the test database).
- Each kind looks at its 40 to 60 best candidates before ranking, so a very common word shows the best of a large set rather than all of it.

## Checks
`tests/searchCore.test.ts` (reading a request, ranking, paging, links) and `scripts/device-checks/search.cjs` (56 real-database checks: every kind answers; people by name, skill, location and filter alone, private never found; startups approved only; employer and investor visibility; jobs open only, filters, both sorts, 12 and 2 across two pages; posts published only and the type filter; suggestions' content, privacy, speed and short-input handling; hostile and oversized input; empty states; the feature switches).

## Deploy and roll back
No database change. Roll back by redeploying the previous version.
