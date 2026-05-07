export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = `${process.env.KV_REST_API_URL}/get/songs`;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(200).json({ songs: [] }); // fallback for local dev without KV
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    
    let songs = data.result;
    if (typeof songs === 'string') {
      try {
        songs = JSON.parse(songs);
      } catch(e) {}
    }
    
    return res.status(200).json({ songs: songs || [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch data from KV' });
  }
}
