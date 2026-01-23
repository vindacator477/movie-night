import { Theater } from '../models/index.js';

// Utah theater chains and common locations
const UTAH_THEATERS: Theater[] = [
  // Megaplex Theatres
  { name: 'Megaplex Theatres at Jordan Commons', address: '9400 S State St, Sandy, UT 84070', chain: 'megaplex' },
  { name: 'Megaplex Theatres at The District', address: '3761 W Parkway Plaza Dr, South Jordan, UT 84095', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Gateway', address: '165 S Rio Grande St, Salt Lake City, UT 84101', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Valley Fair', address: '3620 S 2400 W, West Valley City, UT 84119', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Thanksgiving Point', address: '2935 N Thanksgiving Way, Lehi, UT 84043', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Geneva', address: '1510 E Geneva Rd, Vineyard, UT 84059', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Centerville', address: '250 N Main St, Centerville, UT 84014', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Ogden', address: '2351 Kiesel Ave, Ogden, UT 84401', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Legacy Crossing', address: '1075 W Legacy Crossing Blvd, Centerville, UT 84014', chain: 'megaplex' },
  { name: 'Megaplex Theatres at Pineview', address: '2376 N 400 E, North Ogden, UT 84414', chain: 'megaplex' },

  // Cinemark Theatres
  { name: 'Cinemark Draper and XD', address: '12129 S State St, Draper, UT 84020', chain: 'cinemark' },
  { name: 'Cinemark University Mall', address: '1010 S 800 E, Orem, UT 84097', chain: 'cinemark' },
  { name: 'Cinemark 16 Provo', address: '2424 N University Pkwy, Provo, UT 84604', chain: 'cinemark' },
  { name: 'Cinemark Sugarhouse', address: '2227 S Highland Dr, Salt Lake City, UT 84106', chain: 'cinemark' },
  { name: 'Cinemark Movies 10', address: '1150 N 200 W, Logan, UT 84341', chain: 'cinemark' },
  { name: 'Cinemark St. George', address: '1091 N Bluff St, St. George, UT 84770', chain: 'cinemark' },
];

// ZIP code to city mapping for Utah
const UTAH_ZIP_CITIES: Record<string, string> = {
  '84101': 'Salt Lake City', '84102': 'Salt Lake City', '84103': 'Salt Lake City',
  '84104': 'Salt Lake City', '84105': 'Salt Lake City', '84106': 'Salt Lake City',
  '84107': 'Murray', '84108': 'Salt Lake City', '84109': 'Salt Lake City',
  '84111': 'Salt Lake City', '84112': 'Salt Lake City', '84113': 'Salt Lake City',
  '84115': 'South Salt Lake', '84116': 'Salt Lake City', '84117': 'Holladay',
  '84118': 'West Valley City', '84119': 'West Valley City', '84120': 'West Valley City',
  '84121': 'Cottonwood Heights', '84123': 'Taylorsville', '84124': 'Holladay',
  '84128': 'West Valley City', '84129': 'Taylorsville',
  '84003': 'American Fork', '84004': 'Alpine', '84005': 'Eagle Mountain',
  '84010': 'Bountiful', '84014': 'Centerville',
  '84020': 'Draper', '84043': 'Lehi', '84045': 'Saratoga Springs',
  '84047': 'Midvale', '84057': 'Orem', '84058': 'Orem',
  '84059': 'Vineyard', '84060': 'Park City',
  '84065': 'Riverton', '84070': 'Sandy', '84084': 'West Jordan',
  '84088': 'West Jordan', '84092': 'Sandy', '84093': 'Sandy',
  '84094': 'Sandy', '84095': 'South Jordan', '84096': 'Herriman',
  '84097': 'Orem', '84098': 'Park City',
  '84301': 'Bear River City', '84302': 'Brigham City',
  '84321': 'Logan', '84332': 'Providence', '84341': 'Logan',
  '84401': 'Ogden', '84403': 'Ogden', '84404': 'Ogden', '84405': 'Washington Terrace',
  '84414': 'North Ogden', '84601': 'Provo', '84604': 'Provo', '84606': 'Provo',
  '84651': 'Payson', '84660': 'Spanish Fork', '84663': 'Springville',
  '84701': 'Richfield', '84720': 'Cedar City',
  '84737': 'Hurricane', '84738': 'Ivins', '84770': 'St. George',
  '84780': 'Washington', '84790': 'St. George',
};

export class PlacesService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  }

  async searchTheaters(zip?: string, city?: string): Promise<Theater[]> {
    // For simplicity and reliability, use our curated list
    // In production, you could enhance this with Google Places API

    let searchCity = city;

    if (zip && !city) {
      searchCity = UTAH_ZIP_CITIES[zip];
    }

    if (!searchCity) {
      // Return all Utah theaters if no location specified
      return UTAH_THEATERS;
    }

    // Filter theaters by approximate location
    const normalizedCity = searchCity.toLowerCase();

    // Define regions for better matching
    const saltLakeValley = ['salt lake city', 'murray', 'sandy', 'draper', 'west valley city',
      'west jordan', 'south jordan', 'taylorsville', 'holladay', 'cottonwood heights',
      'midvale', 'riverton', 'herriman', 'south salt lake'];

    const utahCounty = ['provo', 'orem', 'lehi', 'american fork', 'pleasant grove',
      'springville', 'spanish fork', 'payson', 'vineyard', 'saratoga springs', 'eagle mountain', 'alpine'];

    const davisCounty = ['bountiful', 'centerville', 'farmington', 'kaysville', 'layton', 'clearfield'];

    const weberCounty = ['ogden', 'north ogden', 'washington terrace', 'roy', 'south ogden'];

    const cacheCounty = ['logan', 'providence', 'north logan', 'smithfield', 'hyde park'];

    const stGeorgeArea = ['st. george', 'st george', 'washington', 'ivins', 'hurricane', 'cedar city'];

    let relevantTheaters = UTAH_THEATERS;

    if (saltLakeValley.includes(normalizedCity)) {
      relevantTheaters = UTAH_THEATERS.filter(t =>
        t.address.includes('Salt Lake') || t.address.includes('Sandy') ||
        t.address.includes('Draper') || t.address.includes('West Valley') ||
        t.address.includes('South Jordan') || t.address.includes('Murray') ||
        t.address.includes('Taylorsville') || t.address.includes('Holladay') ||
        t.address.includes('Midvale') || t.address.includes('West Jordan')
      );
    } else if (utahCounty.includes(normalizedCity)) {
      relevantTheaters = UTAH_THEATERS.filter(t =>
        t.address.includes('Provo') || t.address.includes('Orem') ||
        t.address.includes('Lehi') || t.address.includes('Vineyard') ||
        t.address.includes('American Fork') || t.address.includes('Springville')
      );
    } else if (davisCounty.includes(normalizedCity)) {
      relevantTheaters = UTAH_THEATERS.filter(t =>
        t.address.includes('Centerville') || t.address.includes('Bountiful') ||
        t.address.includes('Farmington') || t.address.includes('Layton')
      );
    } else if (weberCounty.includes(normalizedCity)) {
      relevantTheaters = UTAH_THEATERS.filter(t =>
        t.address.includes('Ogden') || t.address.includes('North Ogden')
      );
    } else if (cacheCounty.includes(normalizedCity)) {
      relevantTheaters = UTAH_THEATERS.filter(t =>
        t.address.includes('Logan')
      );
    } else if (stGeorgeArea.includes(normalizedCity)) {
      relevantTheaters = UTAH_THEATERS.filter(t =>
        t.address.includes('St. George') || t.address.includes('Cedar City')
      );
    }

    return relevantTheaters.length > 0 ? relevantTheaters : UTAH_THEATERS;
  }
}
