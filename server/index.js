const app = require('./app');

const PORT = process.env.PORT || 8484;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
