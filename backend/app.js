const express = require('express');
const app = express();
const PORT = 8080; // --> .env file

// Define a basic GET route
app.get('/', (req, res) => {
  res.send('Hello World!');

  // hi
  
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
