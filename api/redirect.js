export default function handler(req, res) {
  const { auth_code, state } = req.query;
  res.setHeader('Content-Type', 'text/html');
  if (auth_code) {
    res.status(200).send(`
      <h2>Fyers Auth Code</h2>
      <p><b>auth_code:</b> <code>${auth_code}</code></p>
      <p>Copy this code and paste it into your script.</p>
    `);
  } else {
    res.status(400).send('No auth_code found in query.');
  }
}
