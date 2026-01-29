# Movie Night Coordinator - TODO

## Current Status (Last Updated: 2026-01-28)

The web scraper debugging session made good progress. Here's where we left off:

### Completed This Session
- [x] Fixed Jordan Commons not showing when clicking "Sandy" button
- [x] Extended date selector from 2 days to 7 days
- [x] Fixed false showtime bug - scraper now returns null if movie not found (was returning random showtimes)
- [x] Added `/api/movies/local` endpoint to get movies actually playing locally
- [x] Changed "Now Playing" to "Playing Locally" - now only shows movies with confirmed local showtimes
- [x] Added date parameter to Megaplex scraper URL (`?date=YYYY-MM-DD`)

### Known Issues / TODO

#### High Priority
- [ ] **Megaplex date selector not working** - The scraper adds `?date=` to URL but can't click the on-page date picker. Logs show `Could not find date selector, using default date`. Need to investigate Megaplex's Angular UI to find correct selectors.
- [ ] **Limited Megaplex theaters scraped** - Only scrapes Jordan Commons and Thanksgiving Point. Other Megaplex theaters (District, Valley Fair, etc.) come from Gracenote API. Consider adding more theaters to scraper.
- [ ] **Jordan Commons only shows Luxury showtimes** - May be accurate (Luxury-only theater?) or scraper missing standard format times.

#### Medium Priority
- [ ] **Verify showtime accuracy** - Compare scraped data against actual Megaplex website for a few movies/dates
- [ ] **Add more robust movie matching** - Scraper's `clickOnMovieShowtimes()` sometimes can't find movies. Improve selector strategies.
- [ ] **Cache invalidation** - Consider shorter TTL for showtime cache or manual refresh option

#### Low Priority / Nice to Have
- [ ] Add more Megaplex theater locations to scraper config
- [ ] Consider scraping Cinemark theaters directly (currently Gracenote only)
- [ ] Add loading indicator when fetching local movies
- [ ] Show theater count on movie cards in "Playing Locally" view

### Key Files for Scraper Work
- `backend/src/services/megaplexScraper.ts` - Main Playwright scraper
- `backend/src/services/gracenote.ts` - Gracenote API integration (added `getLocalMovies()`)
- `backend/src/routes/showtimes.ts` - Combines scraper + Gracenote results
- `backend/src/routes/movies.ts` - Added `/local` endpoint
- `backend/src/routes/theaters.ts` - Theater list with fallback merging
- `frontend/src/components/MovieVoting.tsx` - Uses local movies
- `frontend/src/components/LocationInput.tsx` - 7-day date selector

### Testing Commands
```bash
# Rebuild and restart
docker-compose up --build -d

# Clear showtime cache
docker exec movienight-db psql -U movienight -d movienight -c "DELETE FROM showtime_cache;"

# Test showtimes API
curl "http://localhost:3001/api/showtimes?movie=Avatar%3A%20Fire%20and%20Ash&date=2026-02-01&zip=84070"

# Test local movies API
curl "http://localhost:3001/api/movies/local?zip=84070&date=2026-02-01"

# Check scraper logs
docker logs movienight-api --tail 100

# Test theaters for Sandy
curl "http://localhost:3001/api/theaters?city=Sandy"
```

### Debug Notes
- Megaplex website is Angular-based (`ng-tns-c...` classes)
- Scraper logs navigation elements but date picker elements not found
- `api.userway.org` responses are captured but not useful (accessibility widget)
- DOM scraping fallback finds times but not movie-specific without clicking first
