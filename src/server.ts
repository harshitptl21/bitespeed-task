import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Try POSTing to http://localhost:${PORT}/identify`);
  console.log('Example body: { "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }');
});