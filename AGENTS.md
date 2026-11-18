<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Project rules

- Shuttle timetable lives in `src/data/schedule.ts`; stop coordinates in `src/data/stops.ts`; road geometry in `src/data/routes.json` (pre-computed once from Google Routes API and baked in so the public site makes no billable routing calls). Regenerate the JSON rather than hand-editing paths.
- Bus positions/ETAs are simulated from the timetable in `src/lib/shuttle.ts` (pure functions, unit-tested in `src/test/shuttle.test.ts`); UI reads only from there.
- Map uses Google Maps JS via `src/lib/google-maps.ts` (browser key, async loader, no Places in browser); map styling colours live there because the Maps API needs literal colour strings.
- Theme follows `prefers-color-scheme` (CSS media query tokens in `src/styles.css`), no manual toggle.
- Map marker SVGs (bus rotated by heading from `pointAt`, bus-stop sign) live in `src/components/tracker/map-icons.ts`, cached by state; device location comes only from `use-user-location.ts` (starts on user tap, or auto if already granted). Why: one place for icon visuals and permission handling.
- Stop directions open Google Maps via a plain `google.com/maps/dir` link, not the Routes API. Why: free, no billable calls from the public site.
