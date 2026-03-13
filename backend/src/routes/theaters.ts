import { Router, Request, Response } from 'express';

const router = Router();

// Return only Megaplex Jordan Commons - the primary theater we use
router.get('/', async (_req: Request, res: Response) => {
  try {
    const theaters = [
      {
        name: 'Megaplex Jordan Commons',
        address: '9400 S State St, Sandy, UT 84070',
        chain: 'megaplex'
      },
    ];

    res.json(theaters);
  } catch (error) {
    console.error('Error searching theaters:', error);
    res.status(500).json({ error: 'Failed to search theaters' });
  }
});

export default router;
