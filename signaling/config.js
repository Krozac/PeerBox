module.exports = {
  server: {
    port: process.env.SIGNALING_PORT || 5501,
  },
  api: {
    port: process.env.API_PORT || 5502,
  },
  rooms: {
    maxClients: 8,
  },
  games:{
    "afbebc9d-9d21-4284-9317-cb0b6daec6a6":'http://localhost:5173'
  },
  SECRET:"super-secret"
};
