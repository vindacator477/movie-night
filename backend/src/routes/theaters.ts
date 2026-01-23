import { Router, Request, Response } from 'express';
import { PlacesService } from '../services/places.js';

const router = Router();
const placesService = new PlacesService();

// Search Utah theaters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { zip, city } = req.query;

    if (!zip && !city) {
      return res.status(400).json({ error: 'ZIP code or city is required' });
    }

    const theaters = await placesService.searchTheaters(
      zip as string | undefined,
      city as string | undefined
    );

    res.json(theaters);
  } catch (error) {
    console.error('Error searching theaters:', error);
    res.status(500).json({ error: 'Failed to search theaters' });
  }
});

export default router;
