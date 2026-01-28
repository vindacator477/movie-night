import { Router, Request, Response } from 'express';
import { GracenoteService } from '../services/gracenote.js';

const router = Router();
const gracenoteApiKey = process.env.GRACENOTE_API_KEY || '';
const gracenoteService = new GracenoteService(gracenoteApiKey);

// Search theaters from Gracenote API
router.get('/', async (req: Request, res: Response) => {
  try {
    const { zip, city } = req.query;

    if (!zip && !city) {
      return res.status(400).json({ error: 'ZIP code or city is required' });
    }

    if (!gracenoteApiKey) {
      return res.status(500).json({ error: 'Gracenote API not configured' });
    }

    // Convert city to zip if needed
    let zipCode = zip as string;
    if (!zipCode && city) {
      const cityLower = city.toString().toLowerCase().trim();
      const cityToZip: Record<string, string> = {
        'sandy': '84070', 'salt lake city': '84101', 'draper': '84020',
        'south jordan': '84095', 'west jordan': '84084', 'lehi': '84043',
        'orem': '84057', 'provo': '84601', 'ogden': '84401',
        'layton': '84041', 'st. george': '84770', 'st george': '84770',
        'south salt lake': '84115', 'murray': '84107', 'centerville': '84014',
        'west valley': '84119', 'taylorsville': '84129', 'riverton': '84065',
      };
      zipCode = cityToZip[cityLower] || '84070';
    }

    console.log(`Searching theaters near ${zipCode}`);

    // Use a popular movie to get theater listings
    const results = await gracenoteService.getShowtimes({
      movieTitle: 'Avatar', // Currently showing movie
      date: new Date(),
      zip: zipCode,
      radius: 10,
    });

    // Extract unique theaters from showtime results
    const theaterMap = new Map();
    for (const result of results) {
      if (!theaterMap.has(result.theaterName)) {
        theaterMap.set(result.theaterName, {
          name: result.theaterName,
          address: result.theaterAddress || '',
          chain: detectChain(result.theaterName),
        });
      }
    }

    const theaters = Array.from(theaterMap.values());
    console.log(`Found ${theaters.length} theaters near ${zipCode || city}`);
    
    // If no results from Gracenote, return fallback list
    if (theaters.length === 0) {
      res.json(getFallbackTheaters(zipCode));
    } else {
      res.json(theaters);
    }
  } catch (error) {
    console.error('Error searching theaters:', error);
    res.status(500).json({ error: 'Failed to search theaters' });
  }
});

function detectChain(theaterName: string): string {
  const name = theaterName.toLowerCase();
  if (name.includes('megaplex')) return 'megaplex';
  if (name.includes('cinemark')) return 'cinemark';
  if (name.includes('amc')) return 'amc';
  if (name.includes('century')) return 'century';
  if (name.includes('fatcats')) return 'fatcats';
  return 'other';
}

function getFallbackTheaters(zipCode: string): any[] {
  // Fallback list of Utah theaters
  const allTheaters = [
    { name: 'Megaplex Jordan Commons', address: '9400 S State St, Sandy, UT 84070', chain: 'megaplex' },
    { name: 'Megaplex 20 at the District', address: '3761 W Parkway Plaza Dr, South Jordan, UT 84095', chain: 'megaplex' },
    { name: 'Megaplex Theatres at Gateway', address: '165 S Rio Grande St, Salt Lake City, UT 84101', chain: 'megaplex' },
    { name: 'Megaplex Theatres Valley Fair Mall', address: '3620 S 2400 W, West Valley City, UT 84119', chain: 'megaplex' },
    { name: 'Megaplex Theatre Geneva at Vineyard', address: '1510 E Geneva Rd, Vineyard, UT 84059', chain: 'megaplex' },
    { name: 'Megaplex Theatres Lehi', address: '2935 N Thanksgiving Way, Lehi, UT 84043', chain: 'megaplex' },
    { name: 'Megaplex South Jordan at Daybreak', address: '11577 S State St, South Jordan, UT 84020', chain: 'megaplex' },
    { name: 'Cinemark Draper and XD', address: '12129 S State St, Draper, UT 84020', chain: 'cinemark' },
    { name: 'Cinemark West Valley City and XD', address: '3600 S 3200 W, West Valley City, UT 84119', chain: 'cinemark' },
    { name: 'Cinemark Sugarhouse Movies 10', address: '2227 S Highland Dr, Salt Lake City, UT 84106', chain: 'cinemark' },
    { name: 'AMC West Jordan 12', address: '1650 W Main St, West Jordan, UT 84084', chain: 'amc' },
  ];
  
  // Simple distance filtering by zip prefix (not perfect but better than nothing)
  const sandyZips = ['84070', '84090', '84091', '84092', '84093', '84094'];
  const slcZips = ['84101', '84102', '84103', '84104', '84105', '84106', '84111', '84115'];
  
  // For Sandy area, prioritize those theaters
  if (sandyZips.includes(zipCode)) {
    return allTheaters.filter(t => 
      t.name.includes('Jordan Commons') || 
      t.name.includes('Daybreak') ||
      t.name.includes('Gateway') ||
      t.name.includes('District') ||
      t.name.includes('Draper')
    );
  }
  
  return allTheaters;
}

export default router;
