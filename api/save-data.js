export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = `${process.env.KV_REST_API_URL}/set/songs`;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(200).json({ success: true, message: 'Mock save (no KV)' });
  }

  try {
    const { songs } = req.body;
    
    // We stringify the songs array to store it as a single JSON string in KV
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(songs))
    });
    
    const data = await response.json();
    return res.status(200).json({ success: true, result: data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save data to KV' });
  }
}
